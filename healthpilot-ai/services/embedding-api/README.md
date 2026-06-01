# HealthPilot Embedding API (FastAPI)

Production embedding service for RAG. Uses **BAAI/bge-large-en-v1.5** (1024 dimensions) — same model family as `npm run nhs:embed` with `EMBEDDING_PROVIDER=local`.

Supabase Edge Functions call this over **HTTPS**; they cannot reach `127.0.0.1`.

## API

| Method | Path | Body | Response |
|--------|------|------|----------|
| `GET` | `/health` | — | `{ status, model, dimensions }` |
| `POST` | `/embed` | `{ "query": "..." }` | `{ "embedding": [1024 floats] }` |
| `POST` | `/embed` | `{ "texts": ["...", "..."] }` | `{ "embeddings": [[...], ...] }` |

Optional auth: set `EMBEDDING_API_KEY` on the server and send `Authorization: Bearer <key>` or `X-Embedding-Key: <key>`.

## Run locally

```bash
cd services/embedding-api
python -m venv .venv
.venv\Scripts\activate   # Windows
pip install -r requirements.txt
set EMBEDDING_API_KEY=dev-secret
uvicorn app.main:app --host 0.0.0.0 --port 3847
```

Test:

```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:3847/health" -Method GET
Invoke-RestMethod -Uri "http://127.0.0.1:3847/embed" -Method POST -ContentType "application/json" -Headers @{ Authorization = "Bearer dev-secret" } -Body '{"query":"asthma wheezing"}'
```

## Docker (local)

```bash
docker build -t healthpilot-embed .
docker run -p 3847:8080 -e EMBEDDING_API_KEY=dev-secret healthpilot-embed
```

## Deploy to Railway

Railway gives a public HTTPS URL for Supabase Edge (no Fly.io billing required).

### Option A — Dashboard (recommended)

1. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo** (or **Empty Project** + deploy from CLI).
2. If using the monorepo, set **Root Directory** to `services/embedding-api`.
3. Railway detects `Dockerfile` and `railway.json` automatically.
4. **Variables** (service settings):
   - `EMBEDDING_API_KEY` = long random secret (required in prod)
   - `PORT` is set by Railway automatically
5. **Settings → Resources:** allocate **2 GB RAM** minimum (BGE + PyTorch).
6. **Settings → Networking → Generate Domain** → copy URL, e.g. `https://healthpilot-embed-production.up.railway.app`
7. Wait for deploy; open `https://YOUR-DOMAIN/health` — should return `"status": "ok"`.

### Option B — CLI

```bash
npm i -g @railway/cli
cd services/embedding-api
railway login
railway init
railway variables set EMBEDDING_API_KEY=your-long-random-secret
railway up
railway domain
```

### Verify production

```powershell
Invoke-RestMethod -Uri "https://YOUR-DOMAIN/health"
Invoke-RestMethod -Uri "https://YOUR-DOMAIN/embed" -Method POST -ContentType "application/json" -Headers @{ Authorization = "Bearer YOUR_SECRET" } -Body '{"query":"asthma wheezing"}'
```

## Wire Supabase Edge

Use your Railway **HTTPS** domain (no trailing slash):

```bash
npx supabase secrets set EMBEDDING_PROVIDER=http
npx supabase secrets set EMBEDDING_SERVICE_URL=https://YOUR-DOMAIN.up.railway.app
npx supabase secrets set EMBEDDING_API_KEY=your-long-random-secret
npx supabase functions deploy symptom-chat --project-ref YOUR_REF
```

## App `.env` (optional, for local scripts calling the hosted API)

```env
EMBEDDING_PROVIDER=http
EMBEDDING_SERVICE_URL=https://YOUR-DOMAIN.up.railway.app
EMBEDDING_API_KEY=your-long-random-secret
```

## Sizing

- **RAM:** 2 GB+ in Railway service settings
- **Cold start:** first request after idle may take 15–30s while the model loads
- **Build:** Docker image includes the model (~2 GB image); first Railway build can take several minutes

## Dev vs prod

| Environment | Command |
|-------------|---------|
| Dev (Node) | `npm run embed:serve` → `http://127.0.0.1:3847` |
| Prod | This service on Railway (public HTTPS) |

Do **not** set `EMBEDDING_SERVICE_URL=http://127.0.0.1:3847` in **Supabase secrets** for deployed `symptom-chat`.
