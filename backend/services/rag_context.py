"""Shared context loading and prompt building for document chat."""

from __future__ import annotations

from bson import ObjectId

from database import get_documents_col


OUT_OF_CONTEXT = {
    "hindi": "Yeh sawaal document ke context se bahar hai.",
    "english": "This question is out of context for the selected document.",
}


async def load_document_context(doc_id: str | None, user_id: str) -> tuple[dict | None, str]:
    """Load the selected document's raw text for grounded answers.

    Qdrant is still used for focused snippets, but the raw text fallback keeps
    typo-heavy or broad document questions from failing as "unclear".
    """
    if not doc_id:
        return None, ""

    try:
        oid = ObjectId(doc_id)
    except Exception:
        return None, ""

    doc = await get_documents_col().find_one(
        {"_id": oid, "userId": user_id},
        {"fileName": 1, "docType": 1, "summary": 1, "rawText": 1},
    )
    if not doc:
        return None, ""

    return doc, (doc.get("rawText") or "").strip()


def build_document_prompt(
    *,
    question: str,
    language: str,
    past: str,
    qdrant_ctx: str,
    neo4j_ctx: str,
    jurisdiction_ctx: str,
    state: str | None,
    doc: dict | None,
    raw_text: str,
) -> str:
    lang = (
        "Reply in simple Hindi/Hinglish. Use Roman Hindi when the user writes in Roman Hindi."
        if language == "hindi"
        else "Reply in clear English."
    )
    doc_meta = "(none)"
    if doc:
        doc_meta = (
            f"File name: {doc.get('fileName', '(unknown)')}\n"
            f"Document type: {doc.get('docType', '(unknown)')}\n"
            f"Existing summary: {doc.get('summary', '') or '(none)'}"
        )

    prompt = (
        "You are LegalSaathi, a document-grounded legal assistant for Indian citizens.\n"
        f"{lang}\n\n"
        "Rules:\n"
        "- A separate relevance classifier has already approved this question as connected to the uploaded document.\n"
        "- Do not say the question is out of context.\n"
        "- Answer direct extraction questions and inferential legal questions about enforceability, rights, duties, fairness, eviction, default, deposit, notice, termination, and state-law interpretation.\n"
        "- Use the selected document text, retrieved chunks, graph context, and state-law context when relevant.\n"
        "- Cite agreement clauses naturally when the evidence supports it, for example: 'Clause 5 states...'.\n"
        "- Explain whether a right/remedy is immediate or requires due legal procedure.\n"
        "- If the document/state-law evidence is incomplete, say what is missing, but still answer the legal implication that can reasonably be drawn.\n"
        "- Do not ask for clarification just because the wording is short or contains typos; infer the closest document/legal intent.\n"
        "- Do not invent facts that are not in the selected document.\n\n"
        f"=== User History ===\n{past or '(none)'}\n\n"
        f"=== Selected Document ===\n{doc_meta}\n\n"
        f"=== Retrieved Document Chunks ===\n{qdrant_ctx or '(none)'}\n\n"
        f"=== Full Document Text ===\n{raw_text[:12000] or '(none)'}\n\n"
        f"=== Graph Context ===\n{neo4j_ctx or '(none)'}\n\n"
    )

    if jurisdiction_ctx:
        state_label = f" ({state})" if state else ""
        prompt += f"=== State Law Context{state_label} ===\n{jurisdiction_ctx}\n\n"

    return prompt + f"=== Question ===\n{question}"
