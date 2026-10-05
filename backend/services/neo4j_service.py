"""Neo4j knowledge-graph writes + simple reads."""

from __future__ import annotations

import json
import re
from neo4j import AsyncGraphDatabase

from config import settings
from services.llm_service import ainvoke_with_fallback

_driver = None


def get_driver():
    global _driver
    if _driver is None:
        _driver = AsyncGraphDatabase.driver(
            settings.NEO4J_URI,
            auth=(settings.NEO4J_USER, settings.NEO4J_PASSWORD),
        )
    return _driver


async def close_driver() -> None:
    global _driver
    if _driver is not None:
        await _driver.close()
        _driver = None


def _strip_code_fence(text: str) -> str:
    text = text.strip()
    text = re.sub(r"^```(?:json)?", "", text).strip()
    text = re.sub(r"```$", "", text).strip()
    return text


async def extract_entities_llm(raw_text: str) -> dict:
    """Ask the LLM for graph entities as JSON."""
    prompt = (
        "Extract knowledge-graph entities from this Indian legal document. "
        "Respond with JSON only, no prose.\n"
        "Include contract parties, people, companies, legal sections, important clauses, dates, deadlines, "
        "rent/deposit/penalty amounts, and document type when available.\n"
        'Format: {"parties":[],"persons":[],"sections":[],"clauses":[],"dates":[],"amounts":[],"doc_type":""}\n'
        f"Document:\n{raw_text[:4000]}"
    )
    resp = await ainvoke_with_fallback(prompt)
    content = resp.content if hasattr(resp, "content") else str(resp)
    try:
        return json.loads(_strip_code_fence(content))
    except json.JSONDecodeError:
        return {
            "parties": [],
            "persons": [],
            "sections": [],
            "clauses": [],
            "dates": [],
            "amounts": [],
            "doc_type": "",
        }


async def store_entities(entities: dict, doc_id: str) -> None:
    driver = get_driver()
    doc_type = entities.get("doc_type", "") or ""
    async with driver.session() as session:
        await session.run(
            "MERGE (d:Document {id: $doc_id}) SET d.type = $doc_type",
            doc_id=doc_id,
            doc_type=doc_type,
        )
        for party in entities.get("parties") or []:
            name = party.get("name") if isinstance(party, dict) else party
            if not name:
                continue
            await session.run(
                "MERGE (p:Party {name: $name}) "
                "WITH p MATCH (d:Document {id: $doc_id}) "
                "MERGE (d)-[:HAS_PARTY]->(p)",
                name=str(name),
                doc_id=doc_id,
            )
        for person in entities.get("persons") or []:
            name = person.get("name") if isinstance(person, dict) else person
            if not name:
                continue
            await session.run(
                "MERGE (p:Person {name: $name}) "
                "WITH p MATCH (d:Document {id: $doc_id}) "
                "MERGE (d)-[:MENTIONS]->(p)",
                name=str(name),
                doc_id=doc_id,
            )
        for section in entities.get("sections") or []:
            name = section.get("name") if isinstance(section, dict) else section
            if not name:
                continue
            await session.run(
                "MERGE (s:Section {name: $section}) "
                "WITH s MATCH (d:Document {id: $doc_id}) "
                "MERGE (d)-[:CITES]->(s)",
                section=str(name),
                doc_id=doc_id,
            )
        for clause in entities.get("clauses") or []:
            name = clause.get("name") if isinstance(clause, dict) else clause
            if not name:
                continue
            await session.run(
                "MERGE (c:Section {name: $clause}) "
                "WITH c MATCH (d:Document {id: $doc_id}) "
                "MERGE (d)-[:HAS_CLAUSE]->(c)",
                clause=str(name),
                doc_id=doc_id,
            )
        for date in entities.get("dates") or []:
            name = date.get("name") if isinstance(date, dict) else date
            if not name:
                continue
            await session.run(
                "MERGE (dt:Date {name: $date}) "
                "WITH dt MATCH (d:Document {id: $doc_id}) "
                "MERGE (d)-[:HAS_DATE]->(dt)",
                date=str(name),
                doc_id=doc_id,
            )
        for amount in entities.get("amounts") or []:
            name = amount.get("name") if isinstance(amount, dict) else amount
            if not name:
                continue
            await session.run(
                "MERGE (a:Amount {name: $amount}) "
                "WITH a MATCH (d:Document {id: $doc_id}) "
                "MERGE (d)-[:HAS_AMOUNT]->(a)",
                amount=str(name),
                doc_id=doc_id,
            )


async def get_related_context(doc_id: str, limit: int = 10) -> str:
    """Return a short text blob describing graph neighbours of this doc."""
    driver = get_driver()
    async with driver.session() as session:
        result = await session.run(
            "MATCH (d:Document {id: $doc_id})-[r]->(n) "
            "RETURN type(r) AS rel, labels(n)[0] AS label, "
            "       coalesce(n.name, n.id) AS name LIMIT $limit",
            doc_id=doc_id,
            limit=limit,
        )
        rows = [rec.data() async for rec in result]
    if not rows:
        return ""
    parts = [f"{r['label']} '{r['name']}' ({r['rel']})" for r in rows]
    return "Related entities: " + "; ".join(parts)
