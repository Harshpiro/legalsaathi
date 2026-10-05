import logging
from datetime import datetime

from fastapi import APIRouter, Body, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from slowapi import Limiter
from slowapi.util import get_remote_address

from database import get_chats_col
from middleware.auth import verify_clerk
from models.chat import ChatRequest, ChatResponse
from services.rag_service import answer_query
from services.rag_service_stream import answer_query_stream

log = logging.getLogger("legalsaathi.chat")
router = APIRouter()
limiter = Limiter(key_func=get_remote_address)


@router.post("/ask", response_model=ChatResponse)
@limiter.limit("20/minute")
async def ask_question(
    request: Request,
    body: ChatRequest = Body(...),
    user_id: str = Depends(verify_clerk),
):
    question = body.question.strip()
    if not question:
        raise HTTPException(400, "Question cannot be empty")

    try:
        answer = await answer_query(
            question=question,
            user_id=user_id,
            doc_id=body.documentId,
            language=body.language,
            state=body.state,
        )
    except Exception as e:
        log.exception("answer_query failed")
        raise HTTPException(500, f"Chat backend failed: {type(e).__name__}: {e}")

    now = datetime.utcnow()
    await get_chats_col().update_one(
        {"userId": user_id, "documentId": body.documentId},
        {"$push": {"messages": {"$each": [
            {"role": "user", "content": question, "ts": now},
            {"role": "assistant", "content": answer, "ts": now},
        ]}}},
        upsert=True,
    )

    return ChatResponse(answer=answer, language=body.language)


@router.post("/stream")
@limiter.limit("20/minute")
async def stream_answer(
    request: Request,
    body: ChatRequest = Body(...),
    user_id: str = Depends(verify_clerk),
):
    """SSE streaming endpoint — ChatGPT-style typewriter effect.

    Sends status updates during retrieval, then streams tokens one-by-one.
    The full answer is persisted to MongoDB in the 'done' event handler
    on the frontend, or we save it server-side via the memory service.
    """
    question = body.question.strip()
    if not question:
        raise HTTPException(400, "Question cannot be empty")

    state = getattr(body, "state", None)

    async def event_generator():
        full_answer = ""
        async for event in answer_query_stream(
            question=question,
            user_id=user_id,
            doc_id=body.documentId,
            language=body.language,
            state=state,
        ):
            # Capture the full answer from the done event for MongoDB persistence
            if '"type": "done"' in event:
                import json as _json
                try:
                    payload = _json.loads(event.replace("data: ", "").strip())
                    full_answer = payload.get("full_answer", "")
                except Exception:
                    pass
            yield event

        # Persist the chat to MongoDB after streaming completes
        if full_answer:
            now = datetime.utcnow()
            await get_chats_col().update_one(
                {"userId": user_id, "documentId": body.documentId},
                {"$push": {"messages": {"$each": [
                    {"role": "user", "content": question, "ts": now},
                    {"role": "assistant", "content": full_answer, "ts": now},
                ]}}},
                upsert=True,
            )

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/history/{document_id}")
async def get_chat_history(
    document_id: str,
    user_id: str = Depends(verify_clerk),
):
    chat = await get_chats_col().find_one(
        {"userId": user_id, "documentId": document_id},
    )
    return {"messages": (chat or {}).get("messages", [])}
