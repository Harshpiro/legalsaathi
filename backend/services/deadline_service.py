"""Deadline tracking + reminder dispatch.

Pipeline:
  1. After a document is uploaded, `register_deadlines()` extracts the
     timeline and stores one `reminder` document per future event.
  2. APScheduler runs `process_due_reminders()` every few hours. For each
     active reminder it checks which notification windows (7d / 3d / 1d /
     due) have crossed since the last run and sends an email per window.

Reminder schema (MongoDB `reminders` collection):
  _id, userId, documentId, documentName, deadlineDate (datetime, UTC midnight),
  eventLabel, eventLabelEn, eventType, urgency, sourceText,
  status: "active" | "dismissed" | "expired",
  notificationsSent: { "7d": dt, "3d": dt, "1d": dt, "due": dt },
  createdAt, updatedAt
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from bson import ObjectId
from dateutil import parser as dateparser

from database import get_db
from services.clerk_service import get_user_email
from services.email_service import send_email
from services.timeline_service import extract_timeline

log = logging.getLogger("legalsaathi.deadlines")

# Notification windows (in days before deadline)
_WINDOWS: list[tuple[str, int]] = [
    ("7d", 7),
    ("3d", 3),
    ("1d", 1),
    ("due", 0),
]


def _reminders_col():
    return get_db().reminders


def _utc_midnight(dt: datetime) -> datetime:
    return datetime(dt.year, dt.month, dt.day, tzinfo=timezone.utc)


def _today_utc() -> datetime:
    return _utc_midnight(datetime.now(timezone.utc))


def _parse_iso_date(value) -> datetime | None:
    """Parse the LLM-provided date into a tz-aware UTC midnight datetime."""
    if not value:
        return None
    try:
        if isinstance(value, datetime):
            return _utc_midnight(value if value.tzinfo else value.replace(tzinfo=timezone.utc))
        parsed = dateparser.parse(str(value), fuzzy=True)
        return _utc_midnight(parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc))
    except Exception:
        return None


async def register_deadlines_from_text(
    user_id: str,
    document_id: str,
    document_name: str,
    raw_text: str,
) -> int:
    """Extract timeline from `raw_text` and persist future events as reminders.

    Returns count of reminders created.
    """
    if not raw_text:
        return 0
    try:
        events = await extract_timeline(raw_text)
    except Exception:
        log.exception("Timeline extraction failed in deadline registration")
        return 0
    return await register_deadlines_from_events(user_id, document_id, document_name, events)


async def register_deadlines_from_events(
    user_id: str,
    document_id: str,
    document_name: str,
    events: list[dict],
) -> int:
    if not events:
        return 0

    today = _today_utc()
    col = _reminders_col()

    # Drop any existing reminders for this doc — re-uploading should reset state
    await col.delete_many({"userId": user_id, "documentId": document_id})

    created = 0
    for ev in events:
        deadline = _parse_iso_date(ev.get("date"))
        if not deadline or deadline < today:
            continue
        doc = {
            "userId": user_id,
            "documentId": document_id,
            "documentName": document_name,
            "deadlineDate": deadline,
            "eventLabel": str(ev.get("event") or "")[:200],
            "eventLabelEn": str(ev.get("event_en") or "")[:200],
            "eventType": str(ev.get("type") or "informational")[:50],
            "urgency": str(ev.get("urgency") or "informational")[:50],
            "sourceText": str(ev.get("event_en") or ev.get("event") or "")[:500],
            "status": "active",
            "notificationsSent": {},
            "createdAt": datetime.now(timezone.utc),
            "updatedAt": datetime.now(timezone.utc),
        }
        await col.insert_one(doc)
        created += 1

    log.info(
        "Registered %d deadline reminders for doc %s (user %s)",
        created, document_id, user_id,
    )
    return created


async def list_upcoming(user_id: str, lookahead_days: int = 60) -> list[dict]:
    today = _today_utc()
    horizon = today + timedelta(days=lookahead_days)
    cursor = _reminders_col().find({
        "userId": user_id,
        "status": "active",
        "deadlineDate": {"$gte": today, "$lte": horizon},
    }).sort("deadlineDate", 1)
    out: list[dict] = []
    async for r in cursor:
        out.append(_serialise(r))
    return out


async def list_all(user_id: str, limit: int = 200) -> list[dict]:
    cursor = _reminders_col().find({"userId": user_id}).sort("deadlineDate", 1).limit(limit)
    out: list[dict] = []
    async for r in cursor:
        out.append(_serialise(r))
    return out


async def dismiss_reminder(user_id: str, reminder_id: str) -> bool:
    try:
        oid = ObjectId(reminder_id)
    except Exception:
        return False
    result = await _reminders_col().update_one(
        {"_id": oid, "userId": user_id},
        {"$set": {"status": "dismissed", "updatedAt": datetime.now(timezone.utc)}},
    )
    return result.modified_count > 0


async def delete_reminder(user_id: str, reminder_id: str) -> bool:
    try:
        oid = ObjectId(reminder_id)
    except Exception:
        return False
    result = await _reminders_col().delete_one({"_id": oid, "userId": user_id})
    return result.deleted_count > 0


async def delete_for_document(user_id: str, document_id: str) -> int:
    result = await _reminders_col().delete_many({
        "userId": user_id,
        "documentId": document_id,
    })
    return result.deleted_count


def _serialise(reminder: dict) -> dict:
    out = dict(reminder)
    out["_id"] = str(out["_id"])
    deadline = out.get("deadlineDate")
    if isinstance(deadline, datetime):
        out["deadlineDate"] = deadline.isoformat()
        days = (_utc_midnight(deadline if deadline.tzinfo else deadline.replace(tzinfo=timezone.utc)) - _today_utc()).days
        out["daysRemaining"] = days
    sent = out.get("notificationsSent") or {}
    out["notificationsSent"] = {
        k: (v.isoformat() if isinstance(v, datetime) else v)
        for k, v in sent.items()
    }
    for key in ("createdAt", "updatedAt"):
        v = out.get(key)
        if isinstance(v, datetime):
            out[key] = v.isoformat()
    return out


# ─────────────────────── Scheduler job ───────────────────────


def _build_email(reminder: dict, window_label: str, days_left: int) -> tuple[str, str]:
    doc_name = reminder.get("documentName") or "your document"
    event = reminder.get("eventLabelEn") or reminder.get("eventLabel") or "an upcoming deadline"
    deadline = reminder.get("deadlineDate")
    if isinstance(deadline, datetime):
        deadline_str = deadline.strftime("%d %b %Y")
    else:
        deadline_str = str(deadline)

    if window_label == "due":
        subject = f"⚠ Today: {event} — {doc_name}"
        opening = f"This is a reminder that <strong>{event}</strong> is due <strong>today</strong> ({deadline_str})."
    else:
        subject = f"⏰ {days_left} day(s) to go: {event} — {doc_name}"
        opening = (
            f"This is a reminder that <strong>{event}</strong> is coming up in "
            f"<strong>{days_left} day(s)</strong>, on {deadline_str}."
        )

    html = f"""\
<!DOCTYPE html>
<html><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #0f172a; max-width: 600px; margin: 0 auto; padding: 24px;">
  <div style="background: linear-gradient(135deg, #f59e0b 0%, #ea580c 100%); padding: 24px; border-radius: 12px; color: white; margin-bottom: 24px;">
    <h1 style="margin: 0; font-size: 22px;">LegalSaathi Reminder</h1>
  </div>
  <p style="font-size: 16px; line-height: 1.6;">{opening}</p>
  <div style="background: #f8fafc; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 8px; margin: 16px 0;">
    <p style="margin: 4px 0;"><strong>Document:</strong> {doc_name}</p>
    <p style="margin: 4px 0;"><strong>Event:</strong> {event}</p>
    <p style="margin: 4px 0;"><strong>Date:</strong> {deadline_str}</p>
  </div>
  <p style="color: #64748b; font-size: 14px; margin-top: 24px;">
    You're receiving this because LegalSaathi tracked an important date in a document you uploaded.
  </p>
</body></html>"""
    return subject, html


async def process_due_reminders() -> dict:
    """Scan active reminders, send emails for any newly-crossed window.

    Returns a summary dict for logging / debugging.
    """
    now = datetime.now(timezone.utc)
    today = _today_utc()
    col = _reminders_col()

    summary = {"checked": 0, "emails_sent": 0, "expired": 0, "by_window": {}}

    cursor = col.find({"status": "active"})
    async for r in cursor:
        summary["checked"] += 1
        deadline = r.get("deadlineDate")
        if not isinstance(deadline, datetime):
            continue
        if deadline.tzinfo is None:
            deadline = deadline.replace(tzinfo=timezone.utc)
        days_left = (deadline - today).days

        # Past-deadline cleanup
        if days_left < 0:
            await col.update_one(
                {"_id": r["_id"]},
                {"$set": {"status": "expired", "updatedAt": now}},
            )
            summary["expired"] += 1
            continue

        sent_map = r.get("notificationsSent") or {}

        for label, threshold in _WINDOWS:
            if label in sent_map:
                continue
            if days_left <= threshold:
                # This window is crossed and we haven't notified yet — send.
                email = await get_user_email(r["userId"])
                ok = False
                if email:
                    subject, html = _build_email(r, label, days_left)
                    ok = await send_email(email, subject, html)
                # Mark the window regardless of delivery so we don't loop on
                # broken SMTP configs — re-enable by clearing notificationsSent.
                await col.update_one(
                    {"_id": r["_id"]},
                    {"$set": {
                        f"notificationsSent.{label}": now,
                        "updatedAt": now,
                    }},
                )
                if ok:
                    summary["emails_sent"] += 1
                    summary["by_window"][label] = summary["by_window"].get(label, 0) + 1
                # Only fire the closest applicable window per run
                break

    log.info("Deadline scan: %s", summary)
    return summary
