# HealthPilot AI

AI-assisted health guidance for Pakistan — symptom triage, facility discovery (OpenStreetMap), and NHS-based RAG with localized context.

## Repository layout

| Path | Description |
|------|-------------|
| [`healthpilot-ai/`](healthpilot-ai/) | React + Vite app, Supabase edge functions, NHS RAG pipeline |
| [`healthpilot-ai/services/embedding-api/`](healthpilot-ai/services/embedding-api/) | FastAPI BGE embedding service (deploy to Railway) |
| `HealthPilot_AI_CV_Implementation_Plan.md` | Portfolio / CV implementation plan |

## Quick start

```bash
cd healthpilot-ai
npm install
cp .env.example .env   # fill in Supabase + Anthropic keys
npm run dev
```

See [`healthpilot-ai/README.md`](healthpilot-ai/README.md) for full setup, NHS pipeline, and RAG.

## Deploy embedding API (Railway)

```text
Root directory in Railway: healthpilot-ai/services/embedding-api
```

See [`healthpilot-ai/services/embedding-api/README.md`](healthpilot-ai/services/embedding-api/README.md).

## License

Add a license file before public release if required for your use case.
