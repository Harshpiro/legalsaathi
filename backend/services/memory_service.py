"""Mem0 persistent memory — OpenAI LLM/embedder + Qdrant vector + Neo4j graph.

Mirrors the config pattern in the PiyushSirCode reference `mem.py`.
Mem0 is initialised lazily so a missing OpenAI key doesn't crash boot.
"""

from __future__ import annotations

from functools import lru_cache

from config import settings

_QDRANT_HOST = settings.QDRANT_URL.replace("http://", "").replace("https://", "").split(":")[0]
_QDRANT_PORT = int(settings.QDRANT_URL.rsplit(":", 1)[-1]) if ":" in settings.QDRANT_URL.replace("http://", "").replace("https://", "") else 6333


@lru_cache(maxsize=1)
def _mem():
    from mem0 import Memory

    config = {
        "version": "v1.1",
        "llm": {
            "provider": "openai",
            "config": {
                "api_key": settings.OPENAI_API_KEY,
                "model": settings.OPENAI_CHAT_MODEL,
            },
        },
        "embedder": {
            "provider": "openai",
            "config": {
                "api_key": settings.OPENAI_API_KEY,
                "model": settings.OPENAI_EMBEDDING_MODEL,
            },
        },
        "vector_store": {
            "provider": "qdrant",
            "config": {
                "host": _QDRANT_HOST,
                "port": _QDRANT_PORT,
                "collection_name": "legalsaathi_mem0",
            },
        },
        "graph_store": {
            "provider": "neo4j",
            "config": {
                "url": settings.NEO4J_URI,
                "username": settings.NEO4J_USER,
                "password": settings.NEO4J_PASSWORD,
            },
        },
    }
    return Memory.from_config(config)


def save_memory(user_id: str, messages: list[dict]) -> None:
    try:
        _mem().add(messages, user_id=user_id)
    except Exception as e:
        print(f"[mem0] save_memory failed: {e!r}")


def get_memory(user_id: str, query: str) -> str:
    try:
        result = _mem().search(query=query, user_id=user_id)
    except Exception as e:
        print(f"[mem0] get_memory failed: {e!r}")
        return ""

    items = result.get("results") if isinstance(result, dict) else result
    if not items:
        return ""
    memories = [m.get("memory", "") for m in items[:3]]
    return "User history: " + "; ".join(m for m in memories if m)
