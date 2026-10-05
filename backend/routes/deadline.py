"""Deadline reminder REST endpoints."""

from __future__ import annotations

import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException

from config import settings
from middleware.auth import verify_clerk
from services import deadline_service
from services.clerk_service import get_user_email
from services.email_service import send_email, is_configured as smtp_configured

log = logging.getLogger("legalsaathi.deadline")
router = APIRouter()


@router.get("")
async def get_upcoming_deadlines(
    user_id: str = Depends(verify_clerk),
    lookahead_days: int = 60,
):
    items = await deadline_service.list_upcoming(user_id, lookahead_days=lookahead_days)
    return {"items": items, "count": len(items)}


@router.get("/all")
async def get_all_deadlines(user_id: str = Depends(verify_clerk)):
    items = await deadline_service.list_all(user_id)
    return {"items": items, "count": len(items)}


@router.post("/{reminder_id}/dismiss")
async def dismiss(reminder_id: str, user_id: str = Depends(verify_clerk)):
    ok = await deadline_service.dismiss_reminder(user_id, reminder_id)
    if not ok:
        raise HTTPException(404, "Reminder not found")
    return {"dismissed": True}


@router.delete("/{reminder_id}")
async def delete(reminder_id: str, user_id: str = Depends(verify_clerk)):
    ok = await deadline_service.delete_reminder(user_id, reminder_id)
    if not ok:
        raise HTTPException(404, "Reminder not found")
    return {"deleted": True}


@router.post("/run-now")
async def run_now(user_id: str = Depends(verify_clerk)):
    """Trigger the scheduler job manually — handy for debugging."""
    summary = await deadline_service.process_due_reminders()
    return {"summary": summary, "ranAt": datetime.utcnow().isoformat()}


@router.post("/test-email")
async def test_email(user_id: str = Depends(verify_clerk)):
    """Send a sample reminder email to the current user."""
    email = await get_user_email(user_id)
    if not email:
        raise HTTPException(
            400,
            "No email on file. Set DEV_EMAIL in backend/.env (DEV_MODE) or configure CLERK_SECRET_KEY.",
        )
    if not smtp_configured():
        raise HTTPException(
            400,
            "SMTP not configured. Set SMTP_HOST/SMTP_USER/SMTP_PASSWORD in backend/.env.",
        )
    sent = await send_email(
        email,
        "LegalSaathi test reminder",
        "<p>This is a test reminder from <strong>LegalSaathi</strong>. "
        "If you received this, your SMTP setup is working.</p>",
    )
    return {"sent": sent, "to": email}


@router.get("/health")
async def health(user_id: str = Depends(verify_clerk)):
    return {
        "enabled": settings.ENABLE_DEADLINE_NOTIFIER,
        "smtpConfigured": smtp_configured(),
        "intervalHours": settings.NOTIFIER_INTERVAL_HOURS,
        "lookaheadDays": settings.NOTIFIER_LOOKAHEAD_DAYS,
    }
