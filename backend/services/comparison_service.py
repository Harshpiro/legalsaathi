"""Compare two legal documents and return structured diff."""

from __future__ import annotations

import json
import re
import logging

from services.llm_service import ainvoke_with_fallback

log = logging.getLogger("legalsaathi.comparison")


def _strip_code_fence(text: str) -> str:
    text = text.strip()
    text = re.sub(r"^```(?:json)?", "", text).strip()
    text = re.sub(r"```$", "", text).strip()
    return text


async def compare_documents(text1: str, text2: str) -> dict:
    """Use LLM to compare two legal documents and return structured diff.

    Returns:
        dict with keys: added, removed, modified, new_risks, verdict, verdict_en
    """
    prompt = (
        "Compare these two Indian legal documents carefully. "
        "Document A is the ORIGINAL, Document B is the UPDATED version.\n"
        "Identify:\n"
        "1. Clauses ADDED in Doc B that weren't in Doc A\n"
        "2. Clauses REMOVED from Doc A that aren't in Doc B\n"
        "3. Clauses MODIFIED between versions (show what changed)\n"
        "4. New risks introduced in Doc B\n"
        "5. Overall verdict in Hindi and English\n\n"
        "Return JSON only, no prose. Format:\n"
        "{\n"
        '  "added": [{"clause": "...", "summary": "..."}],\n'
        '  "removed": [{"clause": "...", "summary": "..."}],\n'
        '  "modified": [{"before": "...", "after": "...", "impact": "..."}],\n'
        '  "new_risks": [{"clause": "...", "reason": "...", "severity": "high|medium|low"}],\n'
        '  "verdict": "Hindi mein overall assessment",\n'
        '  "verdict_en": "English overall assessment",\n'
        '  "risk_score_change": "+2 more risky" or "-1 less risky" or "same"\n'
        "}\n"
        "Max 6 items per category. If no differences in a category, return [].\n\n"
        f"=== Document A (Original) ===\n{text1[:3000]}\n\n"
        f"=== Document B (Updated) ===\n{text2[:3000]}"
    )

    resp = await ainvoke_with_fallback(prompt)
    content = resp.content if hasattr(resp, "content") else str(resp)

    try:
        data = json.loads(_strip_code_fence(content))
    except json.JSONDecodeError:
        log.warning("Comparison failed to parse JSON response")
        return {
            "added": [],
            "removed": [],
            "modified": [],
            "new_risks": [],
            "verdict": "Comparison parse nahi ho paya. Phir se try karein.",
            "verdict_en": "Comparison could not be parsed. Please try again.",
            "risk_score_change": "unknown",
        }

    # Normalize
    return {
        "added": data.get("added", [])[:6],
        "removed": data.get("removed", [])[:6],
        "modified": data.get("modified", [])[:6],
        "new_risks": data.get("new_risks", [])[:6],
        "verdict": str(data.get("verdict", "")),
        "verdict_en": str(data.get("verdict_en", "")),
        "risk_score_change": str(data.get("risk_score_change", "unknown")),
    }
