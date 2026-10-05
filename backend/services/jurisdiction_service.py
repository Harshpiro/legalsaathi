"""Jurisdiction-aware legal answer engine.

Detects user's state from document text or manual selection,
and injects state-specific legal context into RAG answers.
"""

from __future__ import annotations

import json
import logging
import re

from langchain_qdrant import QdrantVectorStore
from qdrant_client.models import Distance, VectorParams

from services.llm_service import ainvoke_with_fallback, get_embeddings
from services.qdrant_service import get_client
from config import settings

log = logging.getLogger("legalsaathi.jurisdiction")

STATE_LAWS_COLLECTION = "state_laws"

# ── Top 10 Indian states with key legal differences ──
STATE_LAW_DATA = {
    "maharashtra": {
        "state": "Maharashtra",
        "laws": [
            {
                "name": "Maharashtra Rent Control Act, 1999",
                "topics": ["rent", "eviction", "tenant_rights", "rent_increase"],
                "summary": "Maharashtra mein landlord bina court order ke tenant ko nikaal nahi sakta. Rent increase ke liye 4% annual cap hai standard areas mein. Landlord ko structural repairs karna zaroori hai. Tenant ko 90 din ka notice period milta hai. Sub-letting sirf written permission se ho sakti hai.",
            },
            {
                "name": "Maharashtra Stamp Act",
                "topics": ["stamp_duty", "registration", "agreement"],
                "summary": "Maharashtra mein rent agreement pe 0.25% stamp duty lagti hai. 11 months se zyada ka agreement register karna zaroori hai. Leave and License agreement pe stamp duty kam lagti hai.",
            },
        ],
    },
    "delhi": {
        "state": "Delhi",
        "laws": [
            {
                "name": "Delhi Rent Control Act, 1958 (amended 2020)",
                "topics": ["rent", "eviction", "tenant_rights"],
                "summary": "Delhi mein Rs 3500/month se kam rent waale premises pe Rent Control Act lagta hai. Landlord eviction ke liye 6 valid grounds use kar sakta hai — personal use, demolition, non-payment. 15 din ka notice non-payment ke liye. 3 months ka notice agar landlord ko personal use ke liye chahiye.",
            },
            {
                "name": "Delhi Rent Tribunal",
                "topics": ["dispute", "hearing", "tribunal"],
                "summary": "Delhi mein rent disputes ke liye Rent Tribunal hai. Online filing available hai. 60 din mein hearing honi chahiye. Appeal District Court mein jaa sakti hai.",
            },
        ],
    },
    "karnataka": {
        "state": "Karnataka",
        "laws": [
            {
                "name": "Karnataka Rent Act, 1999",
                "topics": ["rent", "eviction", "tenant_rights"],
                "summary": "Karnataka mein 8 months se zyada ka tenant standard rent increase resist kar sakta hai. Eviction notice 15 din ka hona chahiye for non-payment. Landlord structural changes bina tenant consent ke nahi kar sakta.",
            },
        ],
    },
    "tamil_nadu": {
        "state": "Tamil Nadu",
        "laws": [
            {
                "name": "Tamil Nadu Buildings (Lease and Rent Control) Act, 1960",
                "topics": ["rent", "eviction", "tenant_rights"],
                "summary": "Tamil Nadu mein fair rent Rent Controller decide karta hai. Tenant ko 15 din ka notice milta hai rent default pe. Sub-letting pe strict restrictions hain — written consent zaroori. Eviction ke liye court order mandatory hai.",
            },
        ],
    },
    "uttar_pradesh": {
        "state": "Uttar Pradesh",
        "laws": [
            {
                "name": "UP Urban Buildings (Regulation of Letting, Rent and Eviction) Act, 1972",
                "topics": ["rent", "eviction", "tenant_rights", "allotment"],
                "summary": "UP mein District Magistrate ke through allotment system hai kuch areas mein. Rent increase 5% har 3 saal allowed hai. Eviction sirf prescribed grounds pe — non-payment (15 din notice), subletting, nuisance, personal need. Tenant ko 3 months relocation time milta hai.",
            },
        ],
    },
    "rajasthan": {
        "state": "Rajasthan",
        "laws": [
            {
                "name": "Rajasthan Rent Control Act, 2001",
                "topics": ["rent", "eviction", "tenant_rights"],
                "summary": "Rajasthan mein standard rent Rent Tribunal fix karta hai. Eviction notice 1 month ka minimum. Tenant ko essential services deny karna offense hai. Commercial premises pe different rules apply hote hain.",
            },
        ],
    },
    "gujarat": {
        "state": "Gujarat",
        "laws": [
            {
                "name": "Bombay Rents, Hotel and Lodging House Rates Control Act, 1947 (Gujarat extension)",
                "topics": ["rent", "eviction", "tenant_rights"],
                "summary": "Gujarat mein Bombay Rent Act apply hota hai. Standard rent se zyada charge karna illegal hai. Landlord ko 1 month notice dena padta hai eviction ke liye. Premises ka structural change bina permission ke allowed nahi.",
            },
        ],
    },
    "west_bengal": {
        "state": "West Bengal",
        "laws": [
            {
                "name": "West Bengal Premises Tenancy Act, 1997",
                "topics": ["rent", "eviction", "tenant_rights"],
                "summary": "West Bengal mein tenant ko bohot strong protection milti hai. Eviction bohot mushkil hai — sirf 7 specific grounds pe. Rent increase 5% allowed every 5 years. Inheritance of tenancy rights available hain.",
            },
        ],
    },
    "kerala": {
        "state": "Kerala",
        "laws": [
            {
                "name": "Kerala Buildings (Lease and Rent Control) Act, 1965",
                "topics": ["rent", "eviction", "tenant_rights"],
                "summary": "Kerala mein fair rent Rent Control Court decide karta hai. Eviction ke liye 2 months ka notice mandatory. Tenant ke repairs ka haq hai agar landlord nahi kare. Sub-letting generally prohibited hai.",
            },
        ],
    },
    "madhya_pradesh": {
        "state": "Madhya Pradesh",
        "laws": [
            {
                "name": "MP Accommodation Control Act, 1961",
                "topics": ["rent", "eviction", "tenant_rights"],
                "summary": "MP mein Rent Control Court disputes handle karta hai. Eviction ke liye 1 month notice. Standard rent increase 10% allowed har 3 saal. Tenant ko essential services dena landlord ki duty hai.",
            },
        ],
    },
}

# ── State names for the frontend dropdown ──
AVAILABLE_STATES = [
    {"key": k, "name": v["state"]}
    for k, v in STATE_LAW_DATA.items()
]


def _normalise_state(state: str | None) -> str:
    return (state or "").strip().lower().replace(" ", "_").replace("-", "_")


def resolve_state_key(state: str | None, question: str = "") -> str | None:
    state_key = _normalise_state(state)
    if state_key in STATE_LAW_DATA:
        return state_key

    question_norm = _normalise_state(question)
    for key, data in STATE_LAW_DATA.items():
        state_name = _normalise_state(data["state"])
        if key in question_norm or state_name in question_norm:
            return key

    aliases = {
        "up": "uttar_pradesh",
        "u_p": "uttar_pradesh",
        "mp": "madhya_pradesh",
        "m_p": "madhya_pradesh",
    }
    for alias, key in aliases.items():
        if re.search(rf"(^|_){re.escape(alias)}(_|$)", question_norm):
            return key

    return None


def _state_law_texts() -> tuple[list[str], list[dict]]:
    texts: list[str] = []
    metadatas: list[dict] = []
    for state_key, state_data in STATE_LAW_DATA.items():
        for i, law in enumerate(state_data["laws"]):
            texts.append(
                f"State: {state_data['state']}\n"
                f"Law: {law['name']}\n"
                f"Topics: {', '.join(law['topics'])}\n"
                f"Summary: {law['summary']}"
            )
            metadatas.append({
                "state": state_key,
                "law_name": law["name"],
                "chunk_index": i,
            })
    return texts, metadatas


async def ensure_state_law_collection() -> None:
    client = get_client()
    existing = {c.name for c in client.get_collections().collections}
    if STATE_LAWS_COLLECTION not in existing:
        client.create_collection(
            collection_name=STATE_LAWS_COLLECTION,
            vectors_config=VectorParams(
                size=settings.EMBEDDING_DIM,
                distance=Distance.COSINE,
            ),
        )

    count = client.count(collection_name=STATE_LAWS_COLLECTION, exact=True).count
    if count:
        return

    texts, metadatas = _state_law_texts()
    store = QdrantVectorStore(
        client=client,
        collection_name=STATE_LAWS_COLLECTION,
        embedding=get_embeddings(),
    )
    await store.aadd_texts(texts, metadatas=metadatas)


async def search_state_law_context(question: str, state: str | None, k: int = 4) -> str:
    state_key = resolve_state_key(state, question)
    if not state_key:
        return ""

    try:
        await ensure_state_law_collection()
        store = QdrantVectorStore(
            client=get_client(),
            collection_name=STATE_LAWS_COLLECTION,
            embedding=get_embeddings(),
        )
        docs = await store.asimilarity_search(
            question,
            k=k,
            filter={"state": state_key},
        )
        if docs:
            return "\n\n".join(d.page_content for d in docs)
    except Exception:
        log.exception("State law Qdrant search failed; falling back to local law data")

    return await get_state_context(question, state_key)


async def detect_state_from_text(raw_text: str) -> str | None:
    """Use LLM to detect which Indian state a legal document pertains to."""
    prompt = (
        "From this Indian legal document, identify which state/UT's jurisdiction it falls under. "
        "Reply with EXACTLY ONE word — the state key from this list: "
        "maharashtra | delhi | karnataka | tamil_nadu | uttar_pradesh | rajasthan | gujarat | west_bengal | kerala | madhya_pradesh | unknown\n"
        "If you cannot determine, reply 'unknown'.\n\n"
        f"Document:\n{raw_text[:2000]}"
    )
    resp = await ainvoke_with_fallback(prompt)
    content = (resp.content if hasattr(resp, "content") else str(resp)).strip().lower()
    # Extract valid state key
    for token in content.replace(",", " ").replace(".", " ").split():
        if token in STATE_LAW_DATA:
            return token
    return None


async def get_state_context(question: str, state: str) -> str:
    """Get jurisdiction-specific legal context for a given state.

    Searches the in-memory state law database for relevant laws
    based on the question topic.
    """
    state_data = STATE_LAW_DATA.get(_normalise_state(state))
    if not state_data:
        return ""

    # Simple keyword matching to find relevant laws
    question_lower = question.lower()
    relevant_laws = []

    for law in state_data["laws"]:
        # Check if any topic keywords match the question
        for topic in law["topics"]:
            topic_words = topic.replace("_", " ").split()
            if any(w in question_lower for w in topic_words):
                relevant_laws.append(law)
                break

    # If no keyword match, include all laws for the state
    if not relevant_laws:
        relevant_laws = state_data["laws"]

    parts = [
        f"State: {state_data['state']}",
        "Applicable Laws:",
    ]
    for law in relevant_laws:
        parts.append(f"- {law['name']}: {law['summary']}")

    return "\n".join(parts)
