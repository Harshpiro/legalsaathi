"""Bilingual summary of a legal document."""

from services.llm_service import ainvoke_with_fallback


async def summarize_document(raw_text: str) -> str:
    prompt = (
        "Create a bilingual summary of this Indian legal document.\n"
        "Format exactly like this:\n\n"
        "## Hindi Summary\n"
        "- 5 bullet points in simple Hindi/Hinglish, each 1-2 lines.\n\n"
        "## English Summary\n"
        "- The same 5 key points in simple English, each 1-2 lines.\n\n"
        "Avoid tough legal jargon. Do not add anything outside these two sections.\n\n"
        f"Document:\n{raw_text[:4000]}"
    )
    resp = await ainvoke_with_fallback(prompt)
    return resp.content.strip() if hasattr(resp, "content") else str(resp)
