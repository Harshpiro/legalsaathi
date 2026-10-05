"""Detect risky / unfair clauses and return a structured list."""

from __future__ import annotations

import json
import re
from services.llm_service import ainvoke_with_fallback


def _strip_code_fence(text: str) -> str:
    text = text.strip()
    text = re.sub(r"^```(?:json)?", "", text).strip()
    text = re.sub(r"```$", "", text).strip()
    return text


async def detect_risks(raw_text: str) -> list[dict]:
    prompt = (
        "Indian legal document ke risky ya unfair clauses detect karo. "
        "JSON only, no prose. Format:\n"
        '{"risks":[{"clause":"...","reason":"...","severity":"high|medium|low"}]}'
        "\nsverity field spelling is 'severity'. Return at most 6 risks, "
        "highest severity first. If no risks: return {\"risks\":[]}.\n\n"
        f"Document:\n{raw_text[:4000]}"
    )
    resp = await ainvoke_with_fallback(prompt)
    content = resp.content if hasattr(resp, "content") else str(resp)
    try:
        data = json.loads(_strip_code_fence(content))
    except json.JSONDecodeError:
        return []
    risks = data.get("risks", [])
    # Normalise
    out: list[dict] = []
    for r in risks:
        if not isinstance(r, dict):
            continue
        out.append({
            "clause": str(r.get("clause", ""))[:500],
            "reason": str(r.get("reason", ""))[:500],
            "severity": str(r.get("severity", "medium")).lower(),
        })
    return out
