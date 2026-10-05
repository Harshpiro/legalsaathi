"""Document upload + retrieval routes.

The upload flow fixes the v5 `doc_id='temp'` bug by inserting into MongoDB
BEFORE running the LangGraph pipeline, so the pipeline receives the real
ObjectId string and every Qdrant chunk / Neo4j node is tagged correctly.
"""

import asyncio
import logging
from datetime import datetime

from bson import ObjectId
from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from slowapi import Limiter
from slowapi.util import get_remote_address

log = logging.getLogger("legalsaathi.document")

from database import get_chats_col, get_documents_col
from middleware.auth import verify_clerk
from services.pdf_service import IMAGE_CONTENT_TYPES, PDF_CONTENT_TYPES, extract_upload_text
from services.s3_service import upload_file, presign_file_url
from services.summarizer_service import summarize_document
from services.risk_service import detect_risks
from services.classifier_service import classify_document
from services.langgraph_pipeline import pipeline
from services.timeline_service import extract_timeline
from services.comparison_service import compare_documents
from services.neo4j_service import get_driver
from services.qdrant_service import delete_document_chunks
from services import deadline_service

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)


def _serialise(doc: dict) -> dict:
    doc["_id"] = str(doc["_id"])
    # rawText is big — trim on the way out
    doc.pop("rawText", None)
    return doc


@router.post("/upload")
@limiter.limit("10/hour")
async def upload_document(
    request: Request,
    pdf: UploadFile = File(...),
    user_id: str = Depends(verify_clerk),
):
    allowed_types = PDF_CONTENT_TYPES | IMAGE_CONTENT_TYPES
    content_type = pdf.content_type or ""
    if content_type not in allowed_types:
        raise HTTPException(400, "Only PDF or image files (PNG, JPG, JPEG, WEBP) are accepted")

    contents = await pdf.read()
    if not contents:
        raise HTTPException(400, "Empty file")

    filename = pdf.filename or "uploaded-document"
    file_url = await upload_file(contents, filename, user_id, content_type)
    raw_text = await extract_upload_text(contents, content_type)
    if not raw_text:
        raise HTTPException(422, "Could not extract readable text from this file")

    # Insert first to get a real ObjectId — avoids the v5 doc_id='temp' bug
    col = get_documents_col()
    insert_result = await col.insert_one({
        "userId": user_id,
        "fileName": filename,
        "fileUrl": file_url,
        "fileType": content_type,
        "rawText": raw_text,
        "status": "processing",
        "createdAt": datetime.utcnow(),
    })
    doc_id = str(insert_result.inserted_id)

    # LangGraph ingestion (chunk+embed to Qdrant, entities to Neo4j)
    try:
        await pipeline.ainvoke({
            "file_bytes": contents,
            "doc_id": doc_id,
            "raw_text": raw_text,
        })
    except Exception:
        log.exception("LangGraph pipeline failed for doc %s", doc_id)

    # Parallel analysis — each wrapped so one failure doesn't nuke the others
    async def _safe(coro, default, label):
        try:
            return await coro
        except Exception:
            log.exception("analysis step '%s' failed for doc %s", label, doc_id)
            return default

    summary, risks, doc_type = await asyncio.gather(
        _safe(summarize_document(raw_text), "", "summary"),
        _safe(detect_risks(raw_text), [], "risks"),
        _safe(classify_document(raw_text), "other", "classify"),
    )

    await col.update_one(
        {"_id": insert_result.inserted_id},
        {"$set": {
            "summary": summary,
            "risks": risks,
            "docType": doc_type,
            "fileType": content_type,
            "status": "done",
        }},
    )

    # Extract timeline once, cache it on the document, and register reminders.
    try:
        events = await extract_timeline(raw_text)
        await col.update_one(
            {"_id": insert_result.inserted_id},
            {"$set": {"timeline": events}},
        )
        await deadline_service.register_deadlines_from_events(
            user_id, doc_id, filename, events,
        )
    except Exception:
        log.exception("Timeline + deadline extraction failed for doc %s", doc_id)

    return {
        "docId": doc_id,
        "fileName": filename,
        "fileUrl": presign_file_url(file_url),
        "fileType": content_type,
        "summary": summary,
        "risks": risks,
        "docType": doc_type,
        "status": "done",
    }


@router.get("/list")
async def list_documents(user_id: str = Depends(verify_clerk)):
    cursor = get_documents_col().find(
        {"userId": user_id},
        {"rawText": 0},
    ).sort("createdAt", -1).limit(50)
    
    docs = []
    async for d in cursor:
        if "fileUrl" in d:
            d["fileUrl"] = presign_file_url(d["fileUrl"])
        docs.append(_serialise(d))
    return docs


@router.get("/{doc_id}")
async def get_document(doc_id: str, user_id: str = Depends(verify_clerk)):
    try:
        oid = ObjectId(doc_id)
    except Exception:
        raise HTTPException(400, "Invalid document id")

    doc = await get_documents_col().find_one(
        {"_id": oid, "userId": user_id},
        {"rawText": 0},
    )
    if not doc:
        raise HTTPException(404, "Document not found")
    
    if "fileUrl" in doc:
        doc["fileUrl"] = presign_file_url(doc["fileUrl"])
        
    return _serialise(doc)


@router.delete("/{doc_id}")
async def delete_document(doc_id: str, user_id: str = Depends(verify_clerk)):
    try:
        oid = ObjectId(doc_id)
    except Exception:
        raise HTTPException(400, "Invalid document id")

    col = get_documents_col()
    result = await col.delete_one({"_id": oid, "userId": user_id})
    if result.deleted_count == 0:
        raise HTTPException(404, "Document not found")

    await get_chats_col().delete_one({"userId": user_id, "documentId": doc_id})

    try:
        await deadline_service.delete_for_document(user_id, doc_id)
    except Exception:
        log.exception("Reminder cleanup failed for deleted doc %s", doc_id)

    try:
        await delete_document_chunks(doc_id)
    except Exception:
        log.exception("Qdrant cleanup failed for deleted doc %s", doc_id)

    try:
        driver = get_driver()
        async with driver.session() as session:
            await session.run(
                """
                MATCH (d:Document {id: $doc_id})
                OPTIONAL MATCH (d)--(n)
                DETACH DELETE d
                WITH collect(n) AS neighbours
                UNWIND neighbours AS n
                WITH n
                WHERE n IS NOT NULL AND NOT (n)--()
                DETACH DELETE n
                """,
                doc_id=doc_id,
            )
    except Exception:
        log.exception("Neo4j cleanup failed for deleted doc %s", doc_id)

    return {"deleted": True, "docId": doc_id}


@router.get("/{doc_id}/timeline")
async def get_document_timeline(doc_id: str, user_id: str = Depends(verify_clerk)):
    """Extract and cache timeline events from a document."""
    try:
        oid = ObjectId(doc_id)
    except Exception:
        raise HTTPException(400, "Invalid document id")

    col = get_documents_col()
    doc = await col.find_one({"_id": oid, "userId": user_id})
    if not doc:
        raise HTTPException(404, "Document not found")

    # Return cached timeline if it exists
    if doc.get("timeline"):
        return {"events": doc["timeline"]}

    # Extract timeline from raw text
    raw_text = doc.get("rawText", "")
    if not raw_text:
        return {"events": []}

    try:
        events = await extract_timeline(raw_text)
    except Exception:
        log.exception("Timeline extraction failed for doc %s", doc_id)
        events = []

    # Cache the timeline in MongoDB
    await col.update_one({"_id": oid}, {"$set": {"timeline": events}})

    return {"events": events}


@router.post("/compare")
async def compare_two_documents(
    request: Request,
    user_id: str = Depends(verify_clerk),
):
    """Compare two documents and return structured diff."""
    import json as _json
    body = await request.json()
    doc_id_1 = body.get("doc_id_1")
    doc_id_2 = body.get("doc_id_2")

    if not doc_id_1 or not doc_id_2:
        raise HTTPException(400, "Both doc_id_1 and doc_id_2 are required")

    col = get_documents_col()

    try:
        oid1 = ObjectId(doc_id_1)
        oid2 = ObjectId(doc_id_2)
    except Exception:
        raise HTTPException(400, "Invalid document id(s)")

    doc1 = await col.find_one({"_id": oid1, "userId": user_id})
    doc2 = await col.find_one({"_id": oid2, "userId": user_id})

    if not doc1 or not doc2:
        raise HTTPException(404, "One or both documents not found")

    text1 = doc1.get("rawText", "")
    text2 = doc2.get("rawText", "")

    if not text1 or not text2:
        raise HTTPException(422, "Both documents must have extracted text")

    try:
        result = await compare_documents(text1, text2)
    except Exception:
        log.exception("Document comparison failed")
        raise HTTPException(500, "Comparison failed")

    return {
        "doc1": {"id": doc_id_1, "fileName": doc1.get("fileName", "")},
        "doc2": {"id": doc_id_2, "fileName": doc2.get("fileName", "")},
        **result,
    }
