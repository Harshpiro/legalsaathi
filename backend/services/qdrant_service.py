"""Qdrant vector-store operations used by the RAG pipeline."""

from __future__ import annotations

from qdrant_client import QdrantClient
from qdrant_client.models import Distance, FieldCondition, Filter, MatchValue, VectorParams
from langchain_qdrant import QdrantVectorStore

from config import settings
from services.llm_service import get_embeddings

_client: QdrantClient | None = None


def get_client() -> QdrantClient:
    global _client
    if _client is None:
        _client = QdrantClient(url=settings.QDRANT_URL)
    return _client


def init_collection() -> None:
    """Create the collection if it doesn't exist yet. Idempotent."""
    client = get_client()
    existing = {c.name for c in client.get_collections().collections}
    if settings.QDRANT_COLLECTION in existing:
        print(f"Qdrant: collection '{settings.QDRANT_COLLECTION}' exists")
        return
    client.create_collection(
        collection_name=settings.QDRANT_COLLECTION,
        vectors_config=VectorParams(
            size=settings.EMBEDDING_DIM,
            distance=Distance.COSINE,
        ),
    )
    print(f"Qdrant: created collection '{settings.QDRANT_COLLECTION}' "
          f"(dim={settings.EMBEDDING_DIM})")


def _vector_store() -> QdrantVectorStore:
    return QdrantVectorStore(
        client=get_client(),
        collection_name=settings.QDRANT_COLLECTION,
        embedding=get_embeddings(),
    )


async def store_chunks(texts: list[str], doc_id: str, doc_type: str) -> None:
    metadatas = [
        {"doc_id": doc_id, "doc_type": doc_type, "chunk_index": i}
        for i in range(len(texts))
    ]
    await _vector_store().aadd_texts(texts, metadatas=metadatas)


async def search_similar(query: str, doc_id: str | None = None, k: int = 4):
    store = _vector_store()
    if doc_id:
        # `filter` in langchain-qdrant supports a plain dict for equality matches
        return await store.asimilarity_search(query, k=k, filter={"doc_id": doc_id})
    return await store.asimilarity_search(query, k=k)


async def delete_document_chunks(doc_id: str) -> None:
    client = get_client()
    client.delete(
        collection_name=settings.QDRANT_COLLECTION,
        points_selector=Filter(
            must=[
                FieldCondition(
                    key="metadata.doc_id",
                    match=MatchValue(value=doc_id),
                )
            ]
        ),
    )
