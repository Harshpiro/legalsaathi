"""Answer a user question using Mem0 + Qdrant + Neo4j + LLM."""

from __future__ import annotations

import logging

from services.llm_service import ainvoke_with_fallback
from services.qdrant_service import search_similar
from services.neo4j_service import get_related_context
from services.memory_service import get_memory, save_memory
from services.rag_context import OUT_OF_CONTEXT, build_document_prompt, load_document_context
from services.relevance_service import classify_document_relevance
from services.jurisdiction_service import search_state_law_context

log = logging.getLogger("legalsaathi.rag")


async def answer_query(
    question: str,
    user_id: str,
    doc_id: str | None = None,
    language: str = "hindi",
    state: str | None = None,
) -> str:
    past = get_memory(user_id, question)
    doc, raw_text = await load_document_context(doc_id, user_id)

    if doc_id and not raw_text:
        return OUT_OF_CONTEXT.get(language, OUT_OF_CONTEXT["hindi"])

    try:
        docs = await search_similar(question, doc_id=doc_id, k=4)
        qdrant_ctx = "\n\n".join(d.page_content for d in docs)
    except Exception:
        log.exception("Qdrant search failed; continuing without doc context")
        qdrant_ctx = ""

    neo4j_ctx = ""
    if doc_id:
        try:
            neo4j_ctx = await get_related_context(doc_id)
        except Exception:
            log.exception("Neo4j graph read failed; continuing")

    # Jurisdiction context must be retrieved before relevance classification.
    jurisdiction_ctx = ""
    if state:
        try:
            jurisdiction_ctx = await search_state_law_context(question, state, k=4)
        except Exception:
            log.exception("Jurisdiction context failed; continuing")

    # Skip relevance check when a specific document is selected —
    # the user is always asking about their uploaded document.
    if not doc_id:
        classifier_doc_ctx = qdrant_ctx or raw_text[:12000]
        relevance = await classify_document_relevance(
            question=question,
            document_context=classifier_doc_ctx,
            jurisdiction_context=jurisdiction_ctx,
        )
        if not relevance["is_relevant"]:
            answer = OUT_OF_CONTEXT.get(language, OUT_OF_CONTEXT["hindi"])
            save_memory(
                user_id,
                [
                    {"role": "user", "content": question},
                    {"role": "assistant", "content": answer},
                ],
            )
            return answer

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

    resp = await ainvoke_with_fallback(prompt)
    answer = resp.content if hasattr(resp, "content") else str(resp)

    save_memory(
        user_id,
        [
            {"role": "user", "content": question},
            {"role": "assistant", "content": answer},
        ],
    )
    return answer
