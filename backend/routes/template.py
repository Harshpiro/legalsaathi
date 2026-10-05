"""Template generator routes."""

import logging
from fastapi import APIRouter, Body, Depends, HTTPException, Request
from slowapi import Limiter
from slowapi.util import get_remote_address

from middleware.auth import verify_clerk
from models.template import TemplateRequest, TemplateResponse, TEMPLATE_TYPES
from services.template_service import generate_template

log = logging.getLogger("legalsaathi.template_routes")
router = APIRouter()
limiter = Limiter(key_func=get_remote_address)


@router.get("/types")
async def list_template_types(user_id: str = Depends(verify_clerk)):
    """Return all available template types with their form field definitions."""
    return {
        "templates": [
            {
                "type": key,
                "name": val["name"],
                "name_hi": val["name_hi"],
                "description": val["description"],
                "fields": val["fields"],
            }
            for key, val in TEMPLATE_TYPES.items()
        ]
    }


@router.post("/generate", response_model=TemplateResponse)
@limiter.limit("10/hour")
async def generate(
    request: Request,
    body: TemplateRequest = Body(...),
    user_id: str = Depends(verify_clerk),
):
    """Generate a legal document from template type and form fields."""
    if body.template_type not in TEMPLATE_TYPES:
        raise HTTPException(400, f"Unknown template type: {body.template_type}")

    # Validate required fields
    template_def = TEMPLATE_TYPES[body.template_type]
    required_keys = [f["key"] for f in template_def["fields"] if f.get("required")]
    missing = [k for k in required_keys if not body.fields.get(k)]
    if missing:
        raise HTTPException(400, f"Missing required fields: {', '.join(missing)}")

    try:
        result = await generate_template(
            template_type=body.template_type,
            fields=body.fields,
            language=body.language,
        )
    except Exception as e:
        log.exception("Template generation failed")
        raise HTTPException(500, f"Generation failed: {type(e).__name__}: {e}")

    return TemplateResponse(
        template_type=body.template_type,
        title=result["title"],
        content=result["content"],
        language=body.language,
    )
