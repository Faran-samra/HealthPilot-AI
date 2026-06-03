# Setup & deployment

## Local development

### 1. Prerequisites

- **Node.js 20+**
- **npm 10+**
- Supabase project ([supabase.com](https://supabase.com))
- Anthropic API key

### 2. Clone and install

```bash
git clone https://github.com/Faran-samra/HealthPilot-AI.git
cd HealthPilot-AI
npm install
```

### 3. Environment

```bash
cp .env.example .env
```

| Variable | Where | Purpose |
|----------|--------|---------|
| `VITE_SUPABASE_URL` | `.env` | Frontend Supabase client |
| `VITE_SUPABASE_ANON_KEY` | `.env` | Public anon key |
| `ANTHROPIC_API_KEY` | Supabase secret | Edge functions only |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase secret + pipeline `.env` | Traces, doctor ingest |
| `HUGGINGFACE_API_KEY` | Optional | RAG embeddings |

Never commit `.env` with real keys.

### 4. Database

Apply migrations via Supabase SQL editor or CLI:

```bash
npx supabase link --project-ref YOUR_REF
npx supabase db push
```

Migrations `001`–`014` cover: core schema, PostGIS, NHS/RAG, doctor directory, profile details, seed cleanup.

### 5. Edge functions

```bash
npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

npx supabase functions deploy symptom-chat
npx supabase functions deploy analyze-symptoms
npx supabase functions deploy discover-doctors
npx supabase functions deploy get-facility
npx supabase functions deploy who-pakistan-stats
```

Optional RAG:

```bash
npx supabase secrets set HUGGINGFACE_API_KEY=hf_...
npx supabase secrets set EMBEDDING_PROVIDER=huggingface
```

### 6. Run app

```bash
npm run dev
```

Open `http://localhost:5173`

### 7. Verify

```bash
npm run lint
npm run test
npm run build
```

## Doctor directory (optional data)

Requires `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` in `.env`:

```bash
npm run doctors:harvest -- --source marham --limit 500
npm run doctors:fetch -- --source marham --limit 100
npm run doctors:merge -- --auto-approve --publish --limit 500
```

## Production frontend

Build static assets:

```bash
npm run build
```

Deploy `dist/` to Vercel, Netlify, or Supabase Hosting. Set the same `VITE_*` env vars at build time.

**Production demo:** [https://health-pilot-ai-three.vercel.app/](https://health-pilot-ai-three.vercel.app/) (Vercel). Use root `vercel.json` for SPA routing on refresh.

## Embedding API (Railway)

See [services/embedding-api/README.md](../services/embedding-api/README.md). Set Railway **root directory** to `services/embedding-api`.
