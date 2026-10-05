"""Classify a legal document into one of five coarse types."""

from services.llm_service import ainvoke_with_fallback

_VALID = {"rent", "fir", "notice", "employment", "other"}


async def classify_document(raw_text: str) -> str:
    prompt = (
        "Classify this Indian legal document. Reply with EXACTLY ONE word from: "
        "rent | fir | notice | employment | other. No other text.\n\n"
        f"Document:\n{raw_text[:1500]}"
    )
    resp = await ainvoke_with_fallback(prompt)
    raw = (resp.content if hasattr(resp, "content") else str(resp)).strip().lower()
    # LLM often adds punctuation / explanation — take the first valid token
    for token in raw.replace(",", " ").split():
        t = token.strip(".").strip()
        if t in _VALID:
            return t
    return "other"
