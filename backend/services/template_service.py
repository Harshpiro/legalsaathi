"""Generate legal document templates using LLM."""

from __future__ import annotations

import logging
from datetime import date

from services.llm_service import ainvoke_with_fallback

log = logging.getLogger("legalsaathi.template")


async def generate_template(template_type: str, fields: dict, language: str = "hindi") -> dict:
    """Generate a legal document from template type and user-provided fields.

    Returns dict with 'title' and 'content' (markdown formatted).
    """
    today = date.today().strftime("%d/%m/%Y")

    lang_instruction = (
        "Draft in Hindi (Devanagari script). Use simple language an aam aadmi can understand."
        if language == "hindi"
        else "Draft in formal English suitable for official submission in India."
    )

    # Build field summary for prompt
    field_lines = "\n".join(f"- {k}: {v}" for k, v in fields.items() if v)

    prompts = {
        "rti": (
            f"Draft a formal RTI (Right to Information) application under RTI Act 2005 for submission to an Indian government authority.\n"
            f"{lang_instruction}\n"
            f"Date: {today}\n\n"
            f"Details:\n{field_lines}\n\n"
            f"Include:\n"
            f"- Proper format with 'To' address, subject line\n"
            f"- Reference to RTI Act 2005, Section 6(1)\n"
            f"- Numbered list of information requested\n"
            f"- Fee payment mention\n"
            f"- Declaration that this is for personal use\n"
            f"- Signature block\n"
            f"Format as clean markdown."
        ),
        "rent_notice": (
            f"Draft a formal rent-related notice for an Indian property dispute.\n"
            f"{lang_instruction}\n"
            f"Date: {today}\n\n"
            f"Details:\n{field_lines}\n\n"
            f"Include:\n"
            f"- Proper legal notice format\n"
            f"- Reference to applicable Rent Control Act\n"
            f"- Clear statement of demands\n"
            f"- Notice period and consequences\n"
            f"- Signature block\n"
            f"Format as clean markdown."
        ),
        "consumer_complaint": (
            f"Draft a consumer complaint for filing at the Consumer Disputes Redressal Forum in India.\n"
            f"{lang_instruction}\n"
            f"Date: {today}\n\n"
            f"Details:\n{field_lines}\n\n"
            f"Include:\n"
            f"- Case title format (Complainant vs Opposite Party)\n"
            f"- Reference to Consumer Protection Act 2019\n"
            f"- Facts of the case in numbered paragraphs\n"
            f"- Prayer/Relief sought\n"
            f"- Verification and signature block\n"
            f"Format as clean markdown."
        ),
        "police_complaint": (
            f"Draft a written complaint/application to be submitted at a Police Station in India.\n"
            f"{lang_instruction}\n"
            f"Date: {today}\n\n"
            f"Details:\n{field_lines}\n\n"
            f"Include:\n"
            f"- 'To the SHO' addressing format\n"
            f"- Detailed description of the incident\n"
            f"- Request for FIR registration under applicable IPC/BNS sections\n"
            f"- Accused details if known\n"
            f"- Prayer for investigation\n"
            f"- Signature block\n"
            f"Format as clean markdown."
        ),
        "legal_notice": (
            f"Draft a formal legal notice to be sent via registered post/courier in India.\n"
            f"{lang_instruction}\n"
            f"Date: {today}\n\n"
            f"Details:\n{field_lines}\n\n"
            f"Include:\n"
            f"- 'WITHOUT PREJUDICE' header\n"
            f"- Through advocate format (if applicable)\n"
            f"- Facts in numbered paragraphs\n"
            f"- Legal grounds\n"
            f"- Clear demands with deadline\n"
            f"- Consequences of non-compliance\n"
            f"- Signature block\n"
            f"Format as clean markdown."
        ),
    }

    prompt = prompts.get(template_type)
    if not prompt:
        return {
            "title": "Unknown Template",
            "content": f"Template type '{template_type}' not supported.",
        }

    resp = await ainvoke_with_fallback(prompt)
    content = resp.content if hasattr(resp, "content") else str(resp)

    title_map = {
        "rti": "RTI Application" if language == "english" else "RTI आवेदन",
        "rent_notice": "Rent Notice" if language == "english" else "किराया नोटिस",
        "consumer_complaint": "Consumer Complaint" if language == "english" else "उपभोक्ता शिकायत",
        "police_complaint": "Police Complaint" if language == "english" else "पुलिस शिकायत",
        "legal_notice": "Legal Notice" if language == "english" else "कानूनी नोटिस",
    }

    return {
        "title": title_map.get(template_type, template_type),
        "content": content.strip(),
    }
