"""Extract raw text from uploaded PDF or image buffers."""

import base64
import io
import pdfplumber

from services.llm_service import ainvoke_with_fallback


IMAGE_CONTENT_TYPES = {"image/png", "image/jpeg", "image/jpg", "image/webp"}
PDF_CONTENT_TYPES = {"application/pdf", "application/x-pdf"}


def extract_text(file_bytes: bytes) -> str:
    text_parts: list[str] = []
    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text() or ""
            if page_text:
                text_parts.append(page_text)
    return "\n\n".join(text_parts).strip()


async def extract_text_from_image(file_bytes: bytes, content_type: str) -> str:
    """Use a vision model as OCR for scanned/photo legal documents."""
    encoded = base64.b64encode(file_bytes).decode("ascii")
    data_url = f"data:{content_type};base64,{encoded}"
    prompt = (
        "Extract all readable text from this legal document image. "
        "Preserve line breaks, numbering, names, dates, amounts, and clauses as much as possible. "
        "Return only the extracted text. If no readable text is present, return an empty string."
    )
    resp = await ainvoke_with_fallback([
        {
            "role": "user",
            "content": [
                {"type": "text", "text": prompt},
                {"type": "image_url", "image_url": {"url": data_url}},
            ],
        }
    ])
    text = resp.content if hasattr(resp, "content") else str(resp)
    return text.strip()


async def extract_upload_text(file_bytes: bytes, content_type: str | None) -> str:
    if content_type in PDF_CONTENT_TYPES:
        return extract_text(file_bytes)
    if content_type in IMAGE_CONTENT_TYPES:
        return await extract_text_from_image(file_bytes, content_type or "image/png")
    return ""
