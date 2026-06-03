# Doctor directory pipeline (Phase B)

Ingest publicly available doctor metadata with source attribution, review queue, and merge to Supabase.

## Prerequisites

```env
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
# Optional: PMDC_VERIFY_LIVE=true for live PMDC HTML lookup (rate-limited)
```

## Workflow

```bash
# Full Marham run (~6000+ doctors, parallel fetch, all Pakistan + Punjab cities)
npm run doctors:marham-ingest -- --harvest-limit 6000 --fetch-batch 400 --rounds 20 --concurrency 8 --rps 4 --publish

# Or step by step:

# 1. Harvest profile URLs (sitemaps + /doctors/{city} listings) → doctor_import_raw
npm run doctors:harvest -- --source marham --limit 6000 --rps 3
npm run doctors:harvest -- --source oladoc --limit 500
npm run doctors:harvest -- --source hamariweb --limit 500

# 2. Fetch & normalize profile pages (parallel)
npm run doctors:fetch -- --source marham --limit 400 --concurrency 8 --rps 4

# 3. Auto-review (approve rows with name + specialty + city)
npm run doctors:review -- --limit 500

# 4. Merge to doctors table (must be approved — review or --auto-approve)
npm run doctors:review -- --limit 500
npm run doctors:merge -- --limit 500
npm run doctors:merge -- --publish --limit 500
# Or skip separate review step:
npm run doctors:merge -- --auto-approve --publish --limit 500

# 5. PMDC verification batch (stub unless PMDC_VERIFY_LIVE=true)
npm run doctors:pmdc-verify -- --limit 50

# CSV manual import
npm run doctors:import -- scripts/doctors-import-template.csv
```

## Architecture

- `sources/` — Marham, Oladoc, HamariWeb connectors (sitemap + profile parse)
- `lib/` — normalize, dedupe, verification, rate-limited HTTP
- `merge-pipeline.ts` — approved imports → `doctors` + `doctor_source_records`
- `jobs/` — CLI entry points

Published doctors require `publication_status = 'published'` (set via `--publish` on merge).
