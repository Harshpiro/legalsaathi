"""SMTP email sender used by the deadline notifier.

If `SMTP_HOST` is empty the service is a no-op — useful in dev where the
user hasn't configured SMTP yet. Deadlines are still tracked in MongoDB
either way.
"""

from __future__ import annotations

import logging
from email.message import EmailMessage

import aiosmtplib

from config import settings

log = logging.getLogger("legalsaathi.email")


def is_configured() -> bool:
    return bool(settings.SMTP_HOST and settings.SMTP_USER and settings.SMTP_PASSWORD)


async def send_email(to: str, subject: str, html: str, text: str | None = None) -> bool:
    """Send an email. Returns True on success, False on any failure."""
    if not to:
        log.warning("send_email: empty recipient — skipping")
        return False

    if not is_configured():
        log.info(
            "send_email: SMTP not configured — would have sent '%s' to %s",
            subject, to,
        )
        return False

    msg = EmailMessage()
    msg["From"] = settings.SMTP_FROM
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(text or _strip_html(html))
    msg.add_alternative(html, subtype="html")

    try:
        await aiosmtplib.send(
            msg,
            hostname=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            username=settings.SMTP_USER,
            password=settings.SMTP_PASSWORD,
            start_tls=settings.SMTP_USE_TLS,
            timeout=30,
        )
        log.info("send_email: '%s' delivered to %s", subject, to)
        return True
    except Exception:
        log.exception("send_email: failed to deliver '%s' to %s", subject, to)
        return False


def _strip_html(html: str) -> str:
    import re
    return re.sub(r"<[^>]+>", "", html).strip()
