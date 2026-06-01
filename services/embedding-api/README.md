# HealthPilot Embedding API (FastAPI + Hugging Face)

Lightweight **proxy** — no local ML model. All embeddings go through [Hugging Face Inference API](https://huggingface.co/inference-api) (`BAAI/bge-large-en-v1.5`, 1024 dimensions).

Runs on **512MB–1GB** Railway plans (no PyTorch, no model download).

## Environment (Railway Variables)

| Variable | Required | Description |
|----------|----------|-------------|
| `HUGGINGFACE_API_KEY` or `HF_TOKEN` | Yes | [HF token](https://huggingface.co/settings/tokens) with Inference |
| `EMBEDDING_API_KEY` | Recommended | Protects `POST /embed` |
| `HF_EMBEDDING_MODEL` | No | Default `BAAI/bge-large-en-v1.5` |
| `PORT` | Auto | Set by Railway; match **Networking → target port** |

## API

| Method | Path | Body |
|--------|------|------|
| `GET` | `/health` | — |
| `POST` | `/embed` | `{ "query": "..." }` or `{ "texts": ["..."] }` |

## Deploy (Railway)

1. Root directory: `services/embedding-api`
2. Builder: **Dockerfile**
3. Memory: **512 MB** is enough (was 2GB for local BGE)
4. Target port: match logs (`Uvicorn running on ... port XXXX`)
5. Healthcheck: `/health`

## Direct HF (skip Railway)

Edge functions and `npm run nhs:embed` can call Hugging Face directly:

```env
EMBEDDING_PROVIDER=huggingface
HUGGINGFACE_API_KEY=hf_...
```

```bash
npx supabase secrets set HUGGINGFACE_API_KEY=hf_...
npx supabase secrets set EMBEDDING_PROVIDER=huggingface
npx supabase functions deploy symptom-chat --project-ref YOUR_REF
```

## Test

```powershell
Invoke-RestMethod "https://YOUR-APP.up.railway.app/health"
```
