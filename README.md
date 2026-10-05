# LegalSaathi AI

AI-powered legal assistant for every Indian — upload a rent agreement, FIR, court notice, or employment contract and get a **Hindi summary, risk flags, and a RAG-powered chat** about it. Free, 24/7.

Built using LangChain + LangGraph + Qdrant + Neo4j + Mem0 + FastAPI.

---

## Architecture

```
          ┌─────────── Next.js 14 (App Router) ───────────┐
          │  Clerk auth  │  Tailwind + Shadcn  │  Dropzone │
          └──────────────────────┬───────────────────────┘
                                 │ REST + Bearer JWT
          ┌──────────────────────▼───────────────────────┐
          │              FastAPI (Python 3.11)           │
          │  ┌─────────────────────────────────────────┐ │
          │  │ LangGraph ingestion pipeline            │ │
          │  │   parse ➜ classify ➜ chunk+embed ➜      │ │
          │  │   (if FIR/notice) entity extract        │ │
          │  └─────────────────────────────────────────┘ │
          │  ┌─────────────────────────────────────────┐ │
          │  │ asyncio.gather: summarize │ risks │ cls  │ │
          │  └─────────────────────────────────────────┘ │
          │  ┌─────────────────────────────────────────┐ │
          │  │ RAG: Mem0 + Qdrant + Neo4j + LLM         │ │
          │  └─────────────────────────────────────────┘ │
          └──────┬─────────┬────────────┬────────────┬──┘
                 │         │            │            │
          ┌──────▼──┐ ┌────▼────┐ ┌─────▼────┐ ┌─────▼────┐
          │ MongoDB │ │ Qdrant  │ │  Neo4j   │ │  OpenAI  │
          │(docs+   │ │(chunk   │ │(persons, │ │  (chat + │
          │  chats) │ │ vectors)│ │ sections)│ │ embed)   │
          └─────────┘ └─────────┘ └──────────┘ │ Gemini   │
                                               │ fallback │
                                               └──────────┘
```

**LLM provider**: OpenAI primary (`gpt-4o-mini`, `text-embedding-3-small`), Gemini fallback — switched automatically via `services/llm_service.ainvoke_with_fallback`.

**Auth**: Clerk JWT (RS256). In development set `DEV_MODE=true` and the API returns a fixed `dev_user_001` without requiring a token — so the backend is usable before Clerk keys are provisioned.

**Observability**: set `LANGCHAIN_TRACING_V2=true` + `LANGCHAIN_API_KEY` + `LANGCHAIN_PROJECT` and every LLM call auto-traces to [smith.langchain.com](https://smith.langchain.com).

---

## Folder layout

```
LegalSaathi/
├── docker-compose.yml        # MongoDB + Qdrant + Neo4j
├── backend/                  # FastAPI
│   ├── main.py
│   ├── config.py             # pydantic-settings
│   ├── database.py           # Motor / Mongo
│   ├── middleware/auth.py    # Clerk + DEV_MODE bypass
│   ├── models/
│   ├── services/             # llm, pdf, s3, qdrant, neo4j, memory, rag, langgraph_pipeline…
│   └── routes/               # document.py, chat.py
└── frontend/                 # Next.js 14
    ├── app/
    │   ├── (auth)/{sign-in,sign-up}
    │   └── dashboard/{page,[docId]/page}.tsx
    ├── components/{DocumentUploader,ChatInterface,SummaryCard,RiskList}.tsx
    └── lib/api.ts            # Axios + Clerk getToken()
```

---

## Prerequisites

- **Docker Desktop** (for Mongo / Qdrant / Neo4j)
- **Python 3.11+**
- **Node.js 20+** and **npm**
- An **OpenAI API key** (required) — and optionally a **Google AI key** (fallback)
- A **Clerk application** (required when `DEV_MODE=false`)
- **AWS S3** credentials — **optional**, falls back to local `/local-files/…` if unset

---

## Setup

### 1. Clone & configure env

```bash
cp backend/.env.example backend/.env
cp frontend/.env.local.example frontend/.env.local
```

Open `backend/.env` and set at minimum:
- `OPENAI_API_KEY`
- `NEO4J_PASSWORD` — must match the password in `docker-compose.yml` (already pre-filled)

Leave `DEV_MODE=true` while you test the flow end-to-end; flip to `false` once Clerk is wired up.

### 2. Start the data stores

```bash
docker compose up -d
```

This starts:
- MongoDB at `localhost:27017` (user `admin`, pass `admin`)
- Qdrant at `localhost:6333` (REST) / `6334` (gRPC)
- Neo4j Browser at [localhost:7474](http://localhost:7474) (user `neo4j`, pass from `docker-compose.yml`)

### 3. Run the backend

```bash
cd backend
python -m venv .venv
# Windows:  .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Check it worked:
- <http://localhost:8000/health> → `{"status":"ok","dev_mode":true,…}`
- <http://localhost:8000/docs> — Swagger UI. Try `POST /api/documents/upload` with any legal PDF.

### 4. Run the frontend

```bash
cd frontend
npm install
npm run dev
```

Open <http://localhost:3000> and sign up (or click "Dashboard dekhein" if `NEXT_PUBLIC_DEV_MODE=true` on both sides).

---

## Clerk setup (when you're ready to leave DEV_MODE)

1. Create a new application at [clerk.com](https://clerk.com) → **React / Next.js**.
2. From **API Keys**:
   - Copy the **Publishable key** → `frontend/.env.local` → `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - Copy the **Secret key** → `frontend/.env.local` and `backend/.env` → `CLERK_SECRET_KEY`
   - Click **Show JWT public key**, copy the full PEM (including header/footer), and paste into `backend/.env` → `CLERK_PEM_PUBLIC_KEY`.

   ⚠️ **Windows `.env` formatting**: the PEM spans multiple lines. Either put it on one line with literal `\n` escapes:
   ```
   CLERK_PEM_PUBLIC_KEY=-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkq…\n-----END PUBLIC KEY-----
   ```
   or wrap the whole multi-line value in double quotes. The code auto-converts `\n` → newlines.
3. Set `DEV_MODE=false` in `backend/.env` **and** `NEXT_PUBLIC_DEV_MODE=false` in `frontend/.env.local`.
4. Restart both servers.

---

## Environment variables — quick reference

### backend/.env

| Variable | Required? | Purpose |
|---|---|---|
| `DEV_MODE` | yes | `true` bypasses Clerk; `false` enforces JWT |
| `OPENAI_API_KEY` | yes | Primary LLM + embeddings |
| `GOOGLE_AI_API_KEY` | no | Gemini fallback |
| `OPENAI_CHAT_MODEL` | no | Defaults `gpt-4o-mini` |
| `OPENAI_EMBEDDING_MODEL` | no | Defaults `text-embedding-3-small` |
| `EMBEDDING_DIM` | no | Must match the model (1536 for 3-small) |
| `MONGODB_URI` | yes | `mongodb://admin:admin@localhost:27017` default |
| `QDRANT_URL` | yes | `http://localhost:6333` default |
| `NEO4J_URI` / `NEO4J_USER` / `NEO4J_PASSWORD` | yes | Docker defaults are pre-filled |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_REGION` / `AWS_S3_BUCKET` | **no** | Falls back to local disk |
| `CLERK_SECRET_KEY` / `CLERK_PEM_PUBLIC_KEY` | when `DEV_MODE=false` | |
| `LANGCHAIN_TRACING_V2` / `LANGCHAIN_API_KEY` / `LANGCHAIN_PROJECT` | no | Enable LangSmith tracing |

### frontend/.env.local

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk front-end key |
| `CLERK_SECRET_KEY` | Clerk server key (Next middleware) |
| `NEXT_PUBLIC_API_URL` | Defaults `http://localhost:8000` |
| `NEXT_PUBLIC_DEV_MODE` | Must match backend `DEV_MODE` |

---

## Request flow

### Upload — `POST /api/documents/upload`
1. Clerk JWT verified (or DEV bypass) → `user_id`
2. `slowapi` rate-limits to **10/hour** per IP
3. PDF bytes read once (no disk writes); `upload_pdf()` stores to S3 or `./backend/uploads/`
4. **MongoDB `insert_one` first** → real `ObjectId` → fixes the v5 `doc_id='temp'` bug
5. LangGraph runs: `parse → classify → chunk+embed (Qdrant) → conditional entity extract (Neo4j)`
6. `asyncio.gather(summarize, detect_risks, classify)` — 3 parallel LLM calls
7. Mongo `update_one` with `summary / risks / docType / status:"done"`

### Chat — `POST /api/chat/ask`
1. Auth + `20/min` rate limit
2. `Mem0.search` pulls prior user context
3. `Qdrant.similarity_search(k=4, filter={doc_id})` → top chunks
4. `Neo4j MATCH` for related entities
5. Combined prompt → OpenAI (Gemini fallback) → answer
6. `Mem0.add` persists the turn across sessions
7. MongoDB `chats` collection appends the message pair

---

## Verification

**Backend only (after `docker compose up -d` + `uvicorn main:app --reload`):**
```bash
curl http://localhost:8000/health
# → {"status":"ok","version":"6.0.0","dev_mode":true}
```
Upload via Swagger (`/docs`). Then verify:

- **MongoDB**: `docker exec -it legalsaathi_mongo mongosh -u admin -p admin` → `use legalsaathi` → `db.documents.find().pretty()` should show `status:"done"`, summary, risks.
- **Qdrant**: `curl http://localhost:6333/collections/legal_docs` → `points_count > 0`.
- **Neo4j**: open <http://localhost:7474>, run `MATCH (d:Document) RETURN d LIMIT 5`.

**End-to-end (with frontend):**
1. Sign up via Clerk → redirected to `/dashboard`
2. Drop a rent-agreement PDF → spinner → card appears with Hindi summary + colour-coded risk chips
3. Click the card → detail page → ask "`Yeh agreement me eviction clause kya hai?`" → Hindi answer
4. Refresh — chat history persists (MongoDB)
5. Ask a follow-up with pronouns ("`uske baare me aur batao`") — Mem0 provides context across the question

---

## Out of scope for v1

The following from the PDF spec are **deliberately deferred**:
- ReactFlow knowledge-graph visualisation
- Template generator
- AWS EC2 + Nginx + PM2 + GitHub Actions CI/CD — the architecture is designed to slot into that setup, but v1 runs locally
- Streaming responses (SSE)
- LangFuse (LangSmith alone is sufficient)

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `OPENAI_API_KEY not set` on upload | Fill it in `backend/.env`, restart uvicorn |
| `Qdrant collection dim mismatch` | You switched embedding models — delete `./qdrant_data/` and restart |
| `neo4j.exceptions.ServiceUnavailable` | Wait ~30s after `docker compose up` — Neo4j takes longer than the others to boot |
| Frontend can't reach API | Check `NEXT_PUBLIC_API_URL` in `frontend/.env.local` and CORS `FRONTEND_URL` in `backend/.env` |
| `401 Bearer token required` | Either set `DEV_MODE=true` on backend (and `NEXT_PUBLIC_DEV_MODE=true` on frontend) or finish Clerk setup |
| Multiline Clerk PEM breaks | See the Clerk setup note — use `\n`-escaped single line or double-quoted value |
| S3 errors | Leave `AWS_*` blank — the app falls back to `./backend/uploads/` served at `/local-files/…` |

---


