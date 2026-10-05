"""Relevance classifier for document-grounded legal questions."""

from __future__ import annotations

import json
import logging
import re

from services.llm_service import ainvoke_with_fallback

log = logging.getLogger("legalsaathi.relevance")


LEGAL_INFERENCE_KEYWORDS = {
    "evict", "eviction", "enforce", "enforceable", "legal", "legally",
    "rights", "right", "tenant", "landlord", "deposit", "rent", "notice",
    "termination", "terminate", "default", "unpaid", "dues", "fair",
    "unfair", "challenge", "challengeable", "valid", "invalid", "law",
    "delhi", "maharashtra", "uttar", "up", "karnataka", "rajasthan",
    "gujarat", "kerala", "court", "tribunal", "procedure",
}


def _extract_json(text: str) -> dict:
    text = text.strip()
    text = re.sub(r"^```(?:json)?", "", text).strip()
    text = re.sub(r"```$", "", text).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if not match:
            raise
        return json.loads(match.group(0))


def _keyword_relevance(question: str, document_context: str) -> bool:
    question_words = set(re.findall(r"[a-zA-Z]+", question.lower()))
    if not question_words & LEGAL_INFERENCE_KEYWORDS:
        return False

    doc_lower = document_context.lower()
    return any(
        term in doc_lower
        for term in (
            "rent", "evict", "eviction", "notice", "terminate", "termination",
            "deposit", "default", "landlord", "tenant", "licensor", "licensee",
            "lessor", "lessee", "dues", "arrears", "possession",
        )
    )


async def classify_document_relevance(
    *,
    question: str,
    document_context: str,
    jurisdiction_context: str,
) -> dict:
    """Return whether a question belongs to the selected document context."""
    system_prompt = (
        "You are a legal document relevance classifier.\n\n"
        "Your job is to decide whether the user's question is reasonably connected to:\n"
        "1. any factual clause in the uploaded legal document, OR\n"
        "2. the legal implications, enforceability, rights, duties, fairness, or state-law interpretation "
        "of clauses present in the uploaded legal document.\n\n"
        "Return JSON only:\n"
        "{\n"
        '  "is_relevant": true/false,\n'
        '  "reason": "short reason"\n'
        "}\n\n"
        "Mark TRUE generously for inferential legal questions.\n"
        "Only mark FALSE if clearly unrelated."
    )
    user_prompt = (
        "Examples that MUST return TRUE:\n"
        "- Can landlord evict me immediately?\n"
        "- Is this clause enforceable in Delhi?\n"
        "- Can landlord keep my deposit under UP law?\n"
        "- Does this agreement violate tenant rights in Maharashtra?\n\n"
        f"=== Uploaded Document Chunks ===\n{document_context[:9000] or '(none)'}\n\n"
        f"=== Jurisdiction / State Law Chunks ===\n{jurisdiction_context[:5000] or '(none)'}\n\n"
        f"=== User Question ===\n{question}"
    )

    try:
        resp = await ainvoke_with_fallback([
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ])
        content = resp.content if hasattr(resp, "content") else str(resp)
        parsed = _extract_json(content)
        return {
            "is_relevant": bool(parsed.get("is_relevant")),
            "reason": str(parsed.get("reason") or ""),
        }
    except Exception:
        log.exception("Relevance classifier failed; using conservative keyword fallback")
        is_relevant = _keyword_relevance(question, document_context)
        return {
            "is_relevant": is_relevant,
            "reason": "Keyword fallback after classifier failure",
        }
