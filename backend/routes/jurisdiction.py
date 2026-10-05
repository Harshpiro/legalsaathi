"""Jurisdiction routes — list states and detect jurisdiction."""

from __future__ import annotations

import logging
from fastapi import APIRouter, Depends, HTTPException
from middleware.auth import verify_clerk
from services.jurisdiction_service import AVAILABLE_STATES, detect_state_from_text
from database import get_documents_col
from bson import ObjectId

log = logging.getLogger("legalsaathi.jurisdiction")
router = APIRouter()


@router.get("/states")
async def list_states(user_id: str = Depends(verify_clerk)):
    """Return all available states for the jurisdiction dropdown."""
    return {"states": AVAILABLE_STATES}


@router.get("/detect/{doc_id}")
async def detect_document_state(doc_id: str, user_id: str = Depends(verify_clerk)):
    """Auto-detect which state a document's jurisdiction falls under."""
    try:
        oid = ObjectId(doc_id)
    except Exception:
        raise HTTPException(400, "Invalid document id")

    doc = await get_documents_col().find_one(
        {"_id": oid, "userId": user_id},
    )
    if not doc:
        raise HTTPException(404, "Document not found")

    raw_text = doc.get("rawText", "")
    if not raw_text:
        return {"state": None, "message": "No text to analyze"}

    try:
        state = await detect_state_from_text(raw_text)
    except Exception:
        log.exception("State detection failed")
        state = None

    return {"state": state}
