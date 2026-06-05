# NHS → Pakistan RAG pipeline

Structured ingestion of [NHS Conditions A–Z](https://www.nhs.uk/conditions/) for HealthPilot RAG. **Does not store raw HTML.**

## Pipeline steps

| Step | Command | Output |
|------|---------|--------|
| 1 | `npm run nhs:sitemap` | `data/nhs/urls.json` |
| 2 | `npm run nhs:scrape` | `data/nhs/structured/*.json` |
| 3 | `npm run nhs:localize` | `data/nhs/localized/*.json` |
| 4 | `npm run nhs:chunks` | `data/nhs/chunks.json` |
| 5 | `npm run nhs:seed` | Supabase `nhs_conditions` + `medical_chunks` |
| 6 | `npm run nhs:embed` | Vector embeddings (uses structured `buildEmbeddingText`, not raw HTML) |
| — | `npm run nhs:clear-embeddings` | Set `embedding = null` on NHS chunks (after content changes) |
| — | `npm run nhs:reembed` | Clear + re-embed all NHS chunks |

### Structured sections (per condition page)

Scraper maps NHS headings into JSON sections used for RAG chunks:

- **symptoms**, **complications** (risk groups / “can be dangerous”)
- **urgent_care**, **emergency_care** (NHS 111 vs 999 — localized to Pakistan in separate chunks)
- **treatment**, **self_care**, **prevention** (vaccines, contagious period)
- **overview**, **causes**, **diagnosis**

Pakistan-specific chunks: `emergency_advice_pakistan`, `localized_pakistan_context`, `urgent_care`, `emergency_care` (localized wording).

### Test with 5 conditions

Requires Node 20+ and `npm install` (uses `tsx` + `cheerio`).

```bash
npm run nhs:sitemap
npm run nhs:scrape -- --limit 5
npm run nhs:localize
npm run nhs:chunks
npm run nhs:seed
npm run nhs:embed -- --limit 20
```

### Refresh corpus after extractor changes

Re-scrape and re-seed, then rebuild vectors:

```bash
npm run nhs:scrape
npm run nhs:localize
npm run nhs:chunks
npm run nhs:seed
npm run nhs:reembed
```

### Seed fails with `TypeError: fetch failed`

Usually a **network timeout** or **request too large** (12k+ chunks). The seed script now:

- Batches `nhs_conditions` (20 at a time) with retries
- Splits `medical_chunks` by payload size (~350KB) with 120s timeout
- Falls back to single-row upsert on batch failure

Re-run after a partial failure (upserts are idempotent):

```bash
npm run nhs:seed
```

Optional env tuning:

```env
SEED_CONDITIONS_BATCH=15
SEED_CHUNKS_MAX_BYTES=250000
SEED_BATCH_DELAY_MS=500
SEED_FETCH_TIMEOUT_MS=180000
```

## Environment

```env
VITE_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
EMBEDDING_PROVIDER=local     # free, fast on your PC (BGE-large, 1024-dim)
# ANTHROPIC_API_KEY is only for Claude chat — not embeddings
# EMBEDDING_SERVICE_URL=http://127.0.0.1:3847  # + npm run embed:serve for live RAG
```

Scripts load `.env` automatically (`scripts/load-env.ts`).

Apply migrations: `007_llmops_rag.sql`, `008_nhs_conditions.sql`

## Data model

- **`nhs_conditions`** — full structured record + Pakistan fields
- **`medical_chunks`** — section chunks with `source`, `section`, `embedding`

## Localization rules

UK care pathways are transformed in `pipeline/nhs/lib/localize.ts`:

- GP → general physician / hospital OPD
- NHS 111 / 999 → Rescue 1122 / Edhi 115
- Stored in `emergency_advice_pakistan` and `localized_pakistan_context`

Clinical sections (symptoms, causes, treatment) are **not** rewritten — only guidance fields.

### Ingest quality (v2)

- **HTML lists** → `- bullet` lines; **text cleanup** fixes glued words and dedupes paragraphs.
- **Condition-specific** Pakistan emergency chunks only when NHS urgent/emergency sections exist; otherwise one shared `pakistan-general-emergency` chunk.
- **Symptom bullets** split into smaller chunks when a section has multiple `-` items.
- **`embedding_text`** enriched with search aliases, Roman Urdu glosses (curated), urgency/audience tags in `specialty_tags` (`urgency:emergency`, etc.).

After changing extract/chunk logic, re-run from structured data (no full re-scrape required):

```bash
npm run nhs:localize
npm run nhs:chunks
npm run nhs:seed
npm run nhs:reembed
```

## Attribution

Source: NHS UK, Open Government Licence v3.0. Metadata: `source=nhs_uk`, `source_url`.

## Runtime RAG

`symptom-chat` calls `retrieveMedicalContext()` on **finalize** only. Requires a **public** embedding HTTPS URL (not `127.0.0.1`).

**Production (recommended):** FastAPI service in `services/embedding-api/` (BGE-large, 1024d — matches local ingest).

```bash
# Deploy services/embedding-api to Railway (see services/embedding-api/README.md)
npx supabase secrets set EMBEDDING_PROVIDER=http
npx supabase secrets set EMBEDDING_SERVICE_URL=https://your-service.up.railway.app
npx supabase secrets set EMBEDDING_API_KEY=...
npx supabase functions deploy symptom-chat --project-ref YOUR_REF
```

See `services/embedding-api/README.md`.
