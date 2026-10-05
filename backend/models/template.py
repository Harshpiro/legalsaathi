"""Pydantic schemas for the template generator."""

from typing import Optional
from pydantic import BaseModel


class TemplateRequest(BaseModel):
    template_type: str  # rti | rent_notice | consumer_complaint | police_complaint | legal_notice
    language: str = "hindi"  # hindi | english
    fields: dict  # Dynamic fields based on template_type


class TemplateResponse(BaseModel):
    template_type: str
    title: str
    content: str  # Markdown-formatted legal document
    language: str


# ── Field definitions for each template type (for frontend forms) ──

TEMPLATE_TYPES = {
    "rti": {
        "name": "RTI Application",
        "name_hi": "RTI आवेदन",
        "description": "Right to Information Act ke tahat application",
        "fields": [
            {"key": "applicant_name", "label": "Applicant Name / आवेदक का नाम", "type": "text", "required": True},
            {"key": "applicant_address", "label": "Address / पता", "type": "textarea", "required": True},
            {"key": "applicant_phone", "label": "Phone Number", "type": "text", "required": False},
            {"key": "authority_name", "label": "Authority Name / प्राधिकारी का नाम", "type": "text", "required": True},
            {"key": "department", "label": "Ministry/Department / मंत्रालय/विभाग", "type": "text", "required": True},
            {"key": "information_requested", "label": "Information Requested / मांगी गई जानकारी", "type": "textarea", "required": True},
            {"key": "time_period", "label": "Time Period (if applicable)", "type": "text", "required": False},
            {"key": "fee_mode", "label": "Fee Payment Mode", "type": "select", "options": ["IPO", "Court Fee Stamp", "DD", "Online"], "required": False},
        ],
    },
    "rent_notice": {
        "name": "Rent Agreement Notice",
        "name_hi": "किराया नोटिस",
        "description": "Landlord ya tenant ke liye rent notice",
        "fields": [
            {"key": "sender_name", "label": "Sender Name / भेजने वाले का नाम", "type": "text", "required": True},
            {"key": "sender_role", "label": "Role", "type": "select", "options": ["Landlord", "Tenant"], "required": True},
            {"key": "recipient_name", "label": "Recipient Name / प्राप्तकर्ता का नाम", "type": "text", "required": True},
            {"key": "property_address", "label": "Property Address / संपत्ति का पता", "type": "textarea", "required": True},
            {"key": "rent_amount", "label": "Monthly Rent / मासिक किराया", "type": "text", "required": True},
            {"key": "notice_reason", "label": "Notice Reason / नोटिस का कारण", "type": "textarea", "required": True},
            {"key": "notice_period", "label": "Notice Period (days)", "type": "text", "required": False},
            {"key": "agreement_date", "label": "Original Agreement Date", "type": "text", "required": False},
        ],
    },
    "consumer_complaint": {
        "name": "Consumer Complaint",
        "name_hi": "उपभोक्ता शिकायत",
        "description": "Consumer forum ke liye complaint draft",
        "fields": [
            {"key": "complainant_name", "label": "Complainant Name / शिकायतकर्ता का नाम", "type": "text", "required": True},
            {"key": "complainant_address", "label": "Address / पता", "type": "textarea", "required": True},
            {"key": "company_name", "label": "Company/Seller Name / कंपनी का नाम", "type": "text", "required": True},
            {"key": "product_service", "label": "Product/Service", "type": "text", "required": True},
            {"key": "purchase_date", "label": "Purchase Date / खरीदने की तारीख", "type": "text", "required": False},
            {"key": "amount_paid", "label": "Amount Paid / भुगतान राशि", "type": "text", "required": True},
            {"key": "issue_description", "label": "Issue Description / समस्या का विवरण", "type": "textarea", "required": True},
            {"key": "compensation_demanded", "label": "Compensation Demanded / मांगा गया मुआवजा", "type": "text", "required": True},
        ],
    },
    "police_complaint": {
        "name": "Police Complaint",
        "name_hi": "पुलिस शिकायत",
        "description": "Police station ke liye FIR/complaint application",
        "fields": [
            {"key": "complainant_name", "label": "Complainant Name / शिकायतकर्ता का नाम", "type": "text", "required": True},
            {"key": "complainant_address", "label": "Address / पता", "type": "textarea", "required": True},
            {"key": "complainant_phone", "label": "Phone Number", "type": "text", "required": True},
            {"key": "incident_date", "label": "Incident Date / घटना की तारीख", "type": "text", "required": True},
            {"key": "incident_location", "label": "Incident Location / घटना का स्थान", "type": "text", "required": True},
            {"key": "incident_description", "label": "Incident Description / घटना का विवरण", "type": "textarea", "required": True},
            {"key": "accused_details", "label": "Accused Details (if known) / आरोपी की जानकारी", "type": "textarea", "required": False},
            {"key": "witnesses", "label": "Witnesses (if any) / गवाह", "type": "textarea", "required": False},
        ],
    },
    "legal_notice": {
        "name": "Legal Notice",
        "name_hi": "कानूनी नोटिस",
        "description": "General legal notice draft",
        "fields": [
            {"key": "sender_name", "label": "Sender Name / भेजने वाले का नाम", "type": "text", "required": True},
            {"key": "sender_address", "label": "Sender Address / भेजने वाले का पता", "type": "textarea", "required": True},
            {"key": "recipient_name", "label": "Recipient Name / प्राप्तकर्ता का नाम", "type": "text", "required": True},
            {"key": "recipient_address", "label": "Recipient Address / प्राप्तकर्ता का पता", "type": "textarea", "required": True},
            {"key": "subject", "label": "Subject / विषय", "type": "text", "required": True},
            {"key": "facts", "label": "Facts / तथ्य", "type": "textarea", "required": True},
            {"key": "demands", "label": "Demands / मांगें", "type": "textarea", "required": True},
            {"key": "deadline_days", "label": "Response Deadline (days) / जवाब देने की समय सीमा", "type": "text", "required": True},
        ],
    },
}
