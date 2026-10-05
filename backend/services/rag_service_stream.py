"""Streaming version of answer_query — yields SSE events.

Sends status updates (searching Qdrant, reading Neo4j) then streams
LLM tokens one by one for a ChatGPT-style typewriter effect.
"""

from __future__ import annotations

import json
import logging
from typing import AsyncGenerator

from services.llm_service import astream_with_fallback
from services.qdrant_service import search_similar
from services.neo4j_service import get_related_context
from services.memory_service import get_memory, save_memory
from services.rag_context import OUT_OF_CONTEXT, build_document_prompt, load_document_context
from services.relevance_service import classify_document_relevance
from services.jurisdiction_service import search_state_law_context

log = logging.getLogger("legalsaathi.rag_stream")


def _sse(event_type: str, data: dict) -> str:
    """Format a single SSE line."""
    payload = {"type": event_type, **data}
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


async def answer_query_stream(
    question: str,
    user_id: str,
    doc_id: str | None = None,
    language: str = "hindi",
    state: str | None = None,
) -> AsyncGenerator[str, None]:
    """Async generator that yields SSE-formatted strings."""

    # ── Step 1: Memory lookup ──
    yield _sse("status", {"message": "Yaadein dhundh raha hoon..." if language == "hindi" else "Searching memory..."})
    past = get_memory(user_id, question)
    doc, raw_text = await load_document_context(doc_id, user_id)

    if doc_id and not raw_text:
        answer = OUT_OF_CONTEXT.get(language, OUT_OF_CONTEXT["hindi"])
        yield _sse("token", {"content": answer})
        yield _sse("done", {"full_answer": answer})
        return

    # ── Step 2: Qdrant vector search ──
    yield _sse("status", {"message": "Qdrant mein dhundh raha hoon..." if language == "hindi" else "Searching document chunks..."})
    try:
        docs = await search_similar(question, doc_id=doc_id, k=4)
        qdrant_ctx = "\n\n".join(d.page_content for d in docs)
    except Exception:
        log.exception("Qdrant search failed during stream")
        qdrant_ctx = ""

    # ── Step 3: Neo4j graph context ──
    neo4j_ctx = ""
    if doc_id:
        yield _sse("status", {"message": "Graph se entities nikal raha hoon..." if language == "hindi" else "Reading knowledge graph..."})
        try:
            neo4j_ctx = await get_related_context(doc_id)
        except Exception:
            log.exception("Neo4j read failed during stream")

    # ── Step 4: Jurisdiction context (if state provided) ──
    jurisdiction_ctx = ""
    if state:
        yield _sse("status", {"message": f"{state.title()} ke kanoon dekh raha hoon..." if language == "hindi" else f"Checking {state.title()} laws..."})
        try:
            jurisdiction_ctx = await search_state_law_context(question, state, k=4)
        except Exception:
            log.exception("Jurisdiction service failed; continuing without state context")

    # Skip relevance check when a specific document is selected —
    # the user is always asking about their uploaded document.
    if not doc_id:
        yield _sse("status", {"message": "Sawaal ka document se relation check kar raha hoon..." if language == "hindi" else "Checking document relevance..."})
        classifier_doc_ctx = qdrant_ctx or raw_text[:12000]
        relevance = await classify_document_relevance(
            question=question,
            document_context=classifier_doc_ctx,
            jurisdiction_context=jurisdiction_ctx,
        )
        if not relevance["is_relevant"]:
            answer = OUT_OF_CONTEXT.get(language, OUT_OF_CONTEXT["hindi"])
            yield _sse("token", {"content": answer})
            yield _sse("done", {"full_answer": answer})
            save_memory(
                user_id,
                [
                    {"role": "user", "content": question},
                    {"role": "assistant", "content": answer},
                ],
            )
            return

    # ── Step 5: Build prompt ──
    prompt = build_document_prompt(
        question=question,
        language=language,
        past=past,
        qdrant_ctx=qdrant_ctx,
        neo4j_ctx=neo4j_ctx,
        jurisdiction_ctx=jurisdiction_ctx,
        state=state,
        doc=doc,
        raw_text=raw_text,
    )

    # ── Step 6: Stream LLM tokens ──
    yield _sse("status", {"message": "Jawab likh raha hoon..." if language == "hindi" else "Generating answer..."})

    full_answer = ""
    async for token in astream_with_fallback(prompt):
        full_answer += token
        yield _sse("token", {"content": token})

    # ── Step 7: Done ──
    yield _sse("done", {"full_answer": full_answer})

    # Save to memory (fire-and-forget style)
    save_memory(
        user_id,
        [
            {"role": "user", "content": question},
            {"role": "assistant", "content": full_answer},
        ],
    )
