"""LangGraph ingestion pipeline — parse → classify → chunk+embed → entities."""

from __future__ import annotations

from typing import TypedDict

from langchain.text_splitter import RecursiveCharacterTextSplitter
from langgraph.graph import StateGraph, START, END

from services.pdf_service import extract_text
from services.classifier_service import classify_document
from services.qdrant_service import store_chunks
from services.neo4j_service import extract_entities_llm, store_entities

_splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50)


class DocumentState(TypedDict, total=False):
    file_bytes: bytes
    doc_id: str
    raw_text: str
    doc_type: str
    chunks: list[str]
    entities: dict


def parse_node(state: DocumentState) -> DocumentState:
    if state.get("raw_text"):
        return state
    text = extract_text(state["file_bytes"])
    return {**state, "raw_text": text}


async def classify_node(state: DocumentState) -> DocumentState:
    doc_type = await classify_document(state["raw_text"])
    return {**state, "doc_type": doc_type}


async def chunk_embed_node(state: DocumentState) -> DocumentState:
    docs = _splitter.create_documents([state["raw_text"]])
    texts = [d.page_content for d in docs]
    await store_chunks(texts, state["doc_id"], state["doc_type"])
    return {**state, "chunks": texts}


async def entity_extract_node(state: DocumentState) -> DocumentState:
    entities = await extract_entities_llm(state["raw_text"])
    await store_entities(entities, state["doc_id"])
    return {**state, "entities": entities}


def _build() -> any:
    graph = StateGraph(DocumentState)
    graph.add_node("parse", parse_node)
    graph.add_node("classify", classify_node)
    graph.add_node("chunk", chunk_embed_node)
    graph.add_node("extract_entities", entity_extract_node)

    graph.add_edge(START, "parse")
    graph.add_edge("parse", "classify")
    graph.add_edge("classify", "chunk")
    graph.add_edge("chunk", "extract_entities")
    graph.add_edge("extract_entities", END)

    return graph.compile()


pipeline = _build()
