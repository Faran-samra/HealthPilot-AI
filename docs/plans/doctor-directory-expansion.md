# Doctor Discovery & Directory Expansion

## Phase A (done)

- **Nearby Healthcare Facilities** (`/healthcare-facilities`) — OSM hospitals, clinics, labs; `discover-doctors` edge with `facilities_only: true`.
- **Find Doctors** (`/doctors`) — Supabase `doctors` directory with search filters.
- **Migration** `010_doctor_directory_expansion.sql` — sources, verification, `doctor_import_raw`, extended `doctors_within_radius`.
- **Pipeline** `pipeline/doctors/` — normalize, dedupe, CSV import (`npm run doctors:import`).

## Phase B (infrastructure — done)

**Acquisition plan:** [phase-b-doctor-data-acquisition.md](./phase-b-doctor-data-acquisition.md)  
**Pipeline README:** [pipeline/doctors/README.md](../../pipeline/doctors/README.md)

### Database (migration 011)
- `doctor_import_raw.review_status` — pending → approved → published
- `doctor_source_records` — multi-source linkage
- `pmdc_verification_queue` + `doctor_claims`
- `doctors.publication_status` — draft vs published
- RPCs: `search_doctors_directory`, `submit_doctor_claim`, `queue_pmdc_verification`, `recompute_doctor_verification`

### CLI pipeline
`doctors:harvest` → `doctors:fetch` → `doctors:review` → `doctors:merge [--publish]` → `doctors:pmdc-verify`

### App
- Find Doctors: city, specialty, fee min/max, gender, language filters
- Symptom results: directory doctors + OSM facilities panels
- Doctor detail: claim profile form

**Status:** Marham bulk ingest (`doctors:marham-ingest`) — sitemaps + 50+ city listings, parallel fetch, Punjab/smaller cities in `PAKISTAN_CITIES`.  
**Docs:** [DOCTOR_DIRECTORY.md](../DOCTOR_DIRECTORY.md) · [pipeline/doctors/README.md](../../pipeline/doctors/README.md)

## Deploy checklist

```bash
npx supabase db push --linked
npx supabase functions deploy discover-doctors
```

## Data model

| Field | Notes |
|-------|--------|
| `source` | pmdc, marham, oladoc, hamariweb, osm, manual, healthpilot |
| `verification_status` | unverified, verified, cross_verified, community_verified |
