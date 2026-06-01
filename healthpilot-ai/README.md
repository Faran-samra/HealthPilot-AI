# HealthPilot AI

Bilingual (English / Urdu) healthcare navigation for Pakistan. Describe symptoms, get AI-guided specialty recommendations, and find **live** nearby hospitals and clinics from OpenStreetMap.

> **Not a medical diagnosis tool.** Always consult a qualified clinician for care decisions.

## Features

- **Conversational symptom checker** — multi-turn Claude chat with structured tool output (`ask_follow_up`, `submit_symptom_analysis`)
- **Client-side emergency triage** — instant severity hints before the LLM responds
- **Live facility discovery** — Overpass + Nominatim via Supabase Edge Functions (no static doctor database for search)
- **GPS-first location** — facility results ranked near you or your selected city
- **Bilingual UX** — English and Urdu (i18n)
- **Auth & dashboard** — Supabase Auth, symptom history, appointments (legacy seeded doctors)

## Tech stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, TypeScript, Vite, Tailwind, shadcn/ui, Zustand |
| Backend | Supabase (Auth, Postgres, Edge Functions, Realtime) |
| AI | Anthropic Claude (tool calling, model fallback chain) |
| Maps | Leaflet + OpenStreetMap (no Google Maps API key) |

## Quick start

### Prerequisites

- Node.js 20+
- [Supabase CLI](https://supabase.com/docs/guides/cli) (for edge deploy)
- Anthropic API key (Supabase secret)

### 1. Clone and install

```bash
cd healthpilot-ai
npm install
```

### 2. Environment

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Fill in:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Supabase secrets (edge functions)

```bash
npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Apply migrations (SQL Editor or CLI):

```bash
npx supabase db push
```

Deploy edge functions:

```bash
npx supabase functions deploy symptom-chat --project-ref YOUR_REF
npx supabase functions deploy analyze-symptoms --project-ref YOUR_REF
npx supabase functions deploy discover-doctors --project-ref YOUR_REF
npx supabase functions deploy get-facility --project-ref YOUR_REF
```

### 4. Run locally

```bash
npm run dev
```

Open `http://localhost:5173`

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run test` | Vitest unit tests |
| `npm run eval` | LLM eval harness (requires env vars) |

### Running evals

```bash
export VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
export VITE_SUPABASE_ANON_KEY=your-anon-key
npm run eval
```

See [docs/eval-results.md](./docs/eval-results.md) and [eval/cases.jsonl](./eval/cases.jsonl).

## Documentation

- [Architecture](./docs/architecture.md)
- [API contracts (edge functions)](./docs/api-contracts.md)
- [Safety & disclaimers](./docs/safety.md)
- [NHS → Pakistan RAG pipeline](./docs/nhs-pipeline.md)
- [CV / LLMOps implementation plan](../HealthPilot_AI_CV_Implementation_Plan.md)

## Project structure

```
healthpilot-ai/
├── src/                    # React app
├── supabase/
│   ├── functions/          # Edge functions + _shared
│   └── migrations/
├── eval/                   # LLM evaluation dataset & runner
├── docs/
└── corpus/                 # RAG source documents (Phase D)
```

## Live demo

_Add your Vercel/Netlify URL here after deploy._

## License

Private / portfolio — update as needed.
