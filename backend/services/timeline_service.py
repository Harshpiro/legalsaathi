"""Extract dates, deadlines, and time periods from a legal document."""

from __future__ import annotations

import json
import re
import logging
from datetime import datetime, date

from services.llm_service import ainvoke_with_fallback

log = logging.getLogger("legalsaathi.timeline")


def _strip_code_fence(text: str) -> str:
    text = text.strip()
    text = re.sub(r"^```(?:json)?", "", text).strip()
    text = re.sub(r"```$", "", text).strip()
    return text


async def extract_timeline(raw_text: str) -> list[dict]:
    """Use LLM to extract all temporal data from a legal document.

    Returns a list of timeline events sorted by date.
    """
    today = date.today().isoformat()

    prompt = (
        "Extract ALL dates, deadlines, time periods from this Indian legal document. "
        "For each, identify:\n"
        "- date: ISO format (YYYY-MM-DD) if exact date known, otherwise best estimate\n"
        "- event: short description in Hindi (1 line)\n"
        "- event_en: short description in English (1 line)\n"
        "- type: one of hearing|deadline|filing|execution|notice_period|agreement_start|agreement_end|incident\n"
        "- urgency: critical|important|informational\n"
        f"- days_from_now: integer (negative = past, positive = future, relative to today {today})\n\n"
        "If a period is mentioned (e.g. '30 days from notice'), calculate the approximate date.\n"
        "Return JSON only, no prose.\n"
        'Format: {"events": [...]}\n'
        "Return at most 15 events, sorted by date ascending.\n"
        "If no dates found, return {\"events\": []}.\n\n"
        f"Document:\n{raw_text[:4000]}"
    )

    resp = await ainvoke_with_fallback(prompt)
    content = resp.content if hasattr(resp, "content") else str(resp)

    try:
        data = json.loads(_strip_code_fence(content))
    except json.JSONDecodeError:
        log.warning("Timeline extraction failed to parse JSON")
        return []

    events = data.get("events", [])

    # Normalize and validate
    normalized: list[dict] = []
    for ev in events:
        if not isinstance(ev, dict):
            continue
        normalized.append({
            "date": str(ev.get("date", ""))[:10],
            "event": str(ev.get("event", ""))[:200],
            "event_en": str(ev.get("event_en", ""))[:200],
            "type": str(ev.get("type", "informational")).lower(),
            "urgency": str(ev.get("urgency", "informational")).lower(),
            "days_from_now": ev.get("days_from_now"),
        })

    return normalized
