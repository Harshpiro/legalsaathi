"""Look up a Clerk user's primary email by user_id.

Cached in MongoDB `users` collection so we don't hammer Clerk's API on
every reminder. In `DEV_MODE` (or if Clerk lookup fails) we fall back
to `DEV_EMAIL` from env.
"""

from __future__ import annotations

import logging
from datetime import datetime

import httpx

from config import settings
from database import get_db

log = logging.getLogger("legalsaathi.clerk")

_CLERK_API = "https://api.clerk.com/v1"


def _users_col():
    return get_db().users


async def get_user_email(user_id: str) -> str | None:
    """Return primary email for a Clerk user_id, cached in Mongo."""
    if not user_id:
        return None

    cached = await _users_col().find_one({"_id": user_id})
    if cached and cached.get("email"):
        return cached["email"]

    # DEV_MODE bypass — return whichever email the user set in .env
    if settings.DEV_MODE:
        return settings.DEV_EMAIL or None

    if not settings.CLERK_SECRET_KEY:
        log.warning("CLERK_SECRET_KEY not set — cannot look up email for %s", user_id)
        return None

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(
                f"{_CLERK_API}/users/{user_id}",
                headers={"Authorization": f"Bearer {settings.CLERK_SECRET_KEY}"},
            )
            r.raise_for_status()
            data = r.json()
    except Exception:
        log.exception("Clerk user lookup failed for %s", user_id)
        return None

    primary_id = data.get("primary_email_address_id")
    email = None
    for entry in data.get("email_addresses", []) or []:
        if entry.get("id") == primary_id:
            email = entry.get("email_address")
            break
    if not email and data.get("email_addresses"):
        email = data["email_addresses"][0].get("email_address")

    if email:
        await _users_col().update_one(
            {"_id": user_id},
            {"$set": {
                "email": email,
                "updatedAt": datetime.utcnow(),
            }},
            upsert=True,
        )

    return email
