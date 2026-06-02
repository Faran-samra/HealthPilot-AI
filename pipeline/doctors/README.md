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
# 1. Harvest profile URLs from sitemaps → doctor_import_raw (pending)
npm run doctors:harvest -- --source marham --limit 500
npm run doctors:harvest -- --source oladoc --limit 500
npm run doctors:harvest -- --source hamariweb --limit 500

# 2. Fetch & normalize profile pages
npm run doctors:fetch -- --source marham --limit 100

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
