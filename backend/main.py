"""FastAPI entrypoint.

Run:  uvicorn main:app --reload --port 8000
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from config import settings
from database import close_db, connect_db
from routes import chat as chat_routes
from routes import deadline as deadline_routes
from routes import document as document_routes
from routes import graph as graph_routes
from routes import template as template_routes
from routes import jurisdiction as jurisdiction_routes
from services.deadline_service import process_due_reminders
from services.neo4j_service import close_driver as neo4j_close
from services.qdrant_service import init_collection as qdrant_init
from services.jurisdiction_service import ensure_state_law_collection

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
log = logging.getLogger("legalsaathi")

limiter = Limiter(key_func=get_remote_address)
scheduler = AsyncIOScheduler()


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_db()
    try:
        qdrant_init()
        await ensure_state_law_collection()
    except Exception as e:
        log.warning("Qdrant init skipped: %r", e)

    # Deadline notifier — runs in the same event loop as FastAPI
    if settings.ENABLE_DEADLINE_NOTIFIER:
        scheduler.add_job(
            process_due_reminders,
            trigger="interval",
            hours=max(1, settings.NOTIFIER_INTERVAL_HOURS),
            id="deadline_notifier",
            replace_existing=True,
            next_run_time=None,  # don't fire immediately on boot
        )
        scheduler.start()
        log.info(
            "Deadline notifier active — every %dh",
            settings.NOTIFIER_INTERVAL_HOURS,
        )

    yield

    if scheduler.running:
        scheduler.shutdown(wait=False)
    await close_db()
    try:
        await neo4j_close()
    except Exception:
        pass


app = FastAPI(title="LegalSaathi AI", version="6.0.0", lifespan=lifespan)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, "http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    log.info("%s %s", request.method, request.url.path)
    response = await call_next(request)
    log.info("→ %s", response.status_code)
    return response


# Serve locally-uploaded PDFs when AWS is not configured.
_uploads_dir = Path(__file__).resolve().parent / "uploads"
_uploads_dir.mkdir(exist_ok=True)
app.mount("/local-files", StaticFiles(directory=_uploads_dir), name="local-files")

app.include_router(document_routes.router, prefix="/api/documents", tags=["documents"])
app.include_router(chat_routes.router, prefix="/api/chat", tags=["chat"])
app.include_router(graph_routes.router, prefix="/api/graph", tags=["graph"])
app.include_router(template_routes.router, prefix="/api/templates", tags=["templates"])
app.include_router(jurisdiction_routes.router, prefix="/api/jurisdiction", tags=["jurisdiction"])
app.include_router(deadline_routes.router, prefix="/api/deadlines", tags=["deadlines"])


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "version": "6.0.0",
        "dev_mode": settings.DEV_MODE,
    }
