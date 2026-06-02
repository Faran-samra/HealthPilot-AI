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

1. **Active plan required** — expired trials show `Application not found` (404) on the public URL.
2. Root directory: `services/embedding-api`
3. Builder: **Dockerfile** (Config-as-code: `railway.toml`)
4. **Settings → Deploy → Custom Start Command:** leave **empty** (use Dockerfile `CMD` only)
5. Memory: **512 MB** is enough
6. **Networking → target port:** match deploy logs (`Uvicorn running on ... port XXXX`, often `8080`)
7. Variables: `HUGGINGFACE_API_KEY`, optional `EMBEDDING_API_KEY` (must match Supabase if used)
8. Healthcheck: `/health`

### Railway error: “Remove startCommand” / literal `$PORT`

If the dashboard or an old `railway.toml` had:

```text
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

Railway does **not** shell-expand `$PORT` in that field. Clear **Custom Start Command** in the service settings and redeploy so the Dockerfile runs:

```dockerfile
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080}"]
```

## Direct HF (skip Railway) — use while Railway is offline

If Railway trial expired or deploy is broken, **RAG still works** without Railway:

```bash
npx supabase secrets set HUGGINGFACE_API_KEY=hf_... --project-ref omssmuojotmfwhhtuhnv
npx supabase secrets set EMBEDDING_PROVIDER=huggingface --project-ref omssmuojotmfwhhtuhnv
npx supabase functions deploy symptom-chat --project-ref omssmuojotmfwhhtuhnv
```

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
