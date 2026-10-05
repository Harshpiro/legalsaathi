"""LLM + embeddings factory.

Uses LangChain's `init_chat_model` abstraction (same pattern as the
reference `lang_graph/graph.py`). OpenAI is primary, Gemini is the
fallback. A single `get_llm()` is imported by every other service so
provider choice stays in one place.
"""

from __future__ import annotations

import os
from functools import lru_cache

from langchain.chat_models import init_chat_model
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import BaseMessage
from langchain_openai import OpenAIEmbeddings

from config import settings


# LangSmith tracing is turned on simply by exporting the three env vars
# before any LangChain import actually runs — do it here as a safety net.
if settings.LANGCHAIN_TRACING_V2:
    os.environ["LANGCHAIN_TRACING_V2"] = "true"
    os.environ["LANGCHAIN_API_KEY"] = settings.LANGCHAIN_API_KEY
    os.environ["LANGCHAIN_PROJECT"] = settings.LANGCHAIN_PROJECT


@lru_cache(maxsize=1)
def _openai_llm() -> BaseChatModel:
    if not settings.OPENAI_API_KEY:
        raise RuntimeError("OPENAI_API_KEY not set")
    os.environ["OPENAI_API_KEY"] = settings.OPENAI_API_KEY
    return init_chat_model(
        model=settings.OPENAI_CHAT_MODEL,
        model_provider="openai",
    )


@lru_cache(maxsize=1)
def _gemini_llm() -> BaseChatModel:
    if not settings.GOOGLE_AI_API_KEY:
        raise RuntimeError("GOOGLE_AI_API_KEY not set")
    os.environ["GOOGLE_API_KEY"] = settings.GOOGLE_AI_API_KEY
    return init_chat_model(
        model=settings.GEMINI_CHAT_MODEL,
        model_provider="google_genai",
    )


def get_llm() -> BaseChatModel:
    """Return the primary chat model (OpenAI)."""
    return _openai_llm()


async def ainvoke_with_fallback(prompt: str | list) -> BaseMessage:
    """Call OpenAI first; on any exception fall back to Gemini.

    Accepts a string or a list of LangChain messages.
    """
    try:
        return await _openai_llm().ainvoke(prompt)
    except Exception as e:
        print(f"[llm] OpenAI failed ({e!r}) — falling back to Gemini")
        return await _gemini_llm().ainvoke(prompt)


async def astream_with_fallback(prompt: str | list):
    """Stream tokens from OpenAI; fall back to Gemini on failure.

    Yields string chunks (token fragments).
    """
    try:
        async for chunk in _openai_llm().astream(prompt):
            text = chunk.content if hasattr(chunk, "content") else str(chunk)
            if text:
                yield text
    except Exception as e:
        print(f"[llm] OpenAI stream failed ({e!r}) — falling back to Gemini")
        async for chunk in _gemini_llm().astream(prompt):
            text = chunk.content if hasattr(chunk, "content") else str(chunk)
            if text:
                yield text


@lru_cache(maxsize=1)
def get_embeddings() -> OpenAIEmbeddings:
    if not settings.OPENAI_API_KEY:
        raise RuntimeError("OPENAI_API_KEY not set")
    os.environ["OPENAI_API_KEY"] = settings.OPENAI_API_KEY
    return OpenAIEmbeddings(model=settings.OPENAI_EMBEDDING_MODEL)
