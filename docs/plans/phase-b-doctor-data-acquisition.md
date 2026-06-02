# Phase B — Nationwide Doctor Directory: Data Acquisition Plan

**Status:** Planning (pre-implementation)  
**Goal:** Make **Find Doctors** (`/doctors`) the primary nationwide directory with deduplication, verification tiers, specialty mapping, and full search filters.

This document answers: *How do we obtain PMDC, Marham, Oladoc, and HamariWeb data?* — APIs, exports, public directories, partnerships, or scraping — with legal constraints and realistic coverage numbers.

---

## Executive summary

| Source | Official API / bulk export? | Recommended acquisition path | Realistic unique records (after dedupe) |
|--------|----------------------------|------------------------------|----------------------------------------|
| **PMDC** | No public API; no bulk download | **Official data agreement** + **on-demand verification API** (if granted); not bulk scrape | **366k+** registered (identity); **~5k–15k** usefully enrichable in Year 1 without MOU |
| **Marham** | No public API | **Partnership / data license**; fallback: sitemap-guided crawl (high legal risk) | **16k–20k** listings |
| **Oladoc** | No public API | **Partnership / data license**; fallback: sitemap-guided crawl (high legal risk) | **20k–25k** listings (marketing: 25k+) |
| **HamariWeb** | No public API | **Partnership** or **sitemap crawl** (robots permissive; ToS still applies) | **15k–35k** URL profiles (heavy overlap with Marham) |

**Expected merged nationwide directory (realistic):**

| Metric | Estimate |
|--------|----------|
| Raw rows ingested (all sources) | **45k–70k** |
| Unique doctors after dedupe | **25k–35k** |
| With PMDC `verified` flag | **8k–18k** (depends on MOU + matching) |
| With `cross_verified` (2+ sources) | **15k–25k** |
| Rich profiles (fee + hospital + phone + specialty) | **20k–30k** |

PMDC’s **~366k** figure is the **national medical register** (active + inactive, dental, students transitioning, abroad, unemployed). It is **not** the same as “bookable doctors with clinic metadata,” which marketplace platforms approximate at **~20k–40k** combined (with overlap).

---

## Legal & product principles (non-negotiable)

1. **PMDC is the verification authority**, not a commercial directory. Use it to confirm license status and qualifications; do not republish the full register without authorization.
2. **Marham / Oladoc / HamariWeb** are private platforms. Their Terms of Use govern copying, automated access, and republication. **Scraping is not the default strategy** — partnership or licensed feed is.
3. **HealthPilot stores provenance**: every row has `source`, `source_url`, `verification_status`, and `imported_at`. Users see where data came from.
4. **No silent bulk republication** of phone numbers, fees, or photos without a lawful basis (license, consent, or legitimate interest documented in privacy policy — get legal review for PK context).
5. **Rate limits & robots.txt** must be respected for any technical collection. Marham disallows query-string URLs globally (`Disallow: /*?*`), which complicates naive crawlers.
6. **Deduplication is mandatory** — the same doctor appears on 2–4 platforms; merged profiles improve quality and reduce legal surface (one canonical HealthPilot record with attribution).

---

## Source 1 — PMDC (Pakistan Medical & Dental Council)

### What exists today

- **Official portals:** [online.pmdc.pk](https://online.pmdc.pk/), [pmdc.pk](https://pmdc.pk/)
- **Public search only:** by **registration number**, **full name**, or **father’s name**
- **Published stats (2025–2026):** ~**366,443** total registered practitioners (~325k medical, ~41k dental) on official homepages
- **No** documented REST/GraphQL API, CSV export, or developer program for third parties

### What PMDC data is good for

| Field | Availability |
|-------|----------------|
| Full name | Yes |
| PMDC / registration number | Yes |
| Qualification(s) | Yes |
| Registration / license status | Yes |
| Specialty (practice) | Limited / inconsistent in public search |
| City, clinic, fee, phone | **No** in public register |
| Gender, languages | **No** |

### Acquisition options (ranked)

#### Option A — Official data sharing (RECOMMENDED)

**How:** Formal request to PMDC / Ministry of NHSR&C for:

- Periodic **sanitized register export** (CSV/API) for health-information purposes, or
- **Verification API**: HealthPilot sends `pmdc_number` or `{name, father_name}` → returns `{status, qualifications, valid_until}`

**Pros:** Legally sound; enables `verification_status = verified` at scale  
**Cons:** Slow (months); may require MOU, security audit, Pakistani entity  
**Realistic yield:** Up to **full register** for identity; **0** clinic/commercial fields unless combined with other sources

**Action items:**

1. Draft MOU scope: verification-only vs. directory republication
2. Contact: licensing desk (`licensing.online@pmc.gov.pk` listed on search portal)
3. Propose read-only verification endpoint used during merge, not public scraping

#### Option B — On-demand verification (no bulk)

**How:** When ingesting Marham/Oladoc/HamariWeb/claimed profiles, queue **PMDC lookup** for doctors with known `pmdc_number` or high-confidence name match.

**Implementation:** Human-assisted or tightly rate-limited automation against the **public search UI** only if Terms allow (currently **not clearly permitted** for automation — treat as **grey**; prefer Option A).

**Realistic yield:** **500–2,000 verifications/month** without overload; scales with MOU

#### Option C — Bulk scraping PMDC search (NOT RECOMMENDED)

**Why not:** No robots/API contract; register is government data but **access method** is restricted to interactive search; high risk of IP block and regulatory complaint; cannot populate fee/clinic anyway.

### PMDC estimated counts

| Measure | Count |
|---------|-------|
| Total on register (official stat) | **~366k** |
| Practicing clinicians with findable practice info (marketplace proxy) | **~20k–40k** nationally |
| Records HealthPilot can mark `verified` Year 1 (no MOU) | **~1k–3k** (manual/sample) |
| With MOU / verification API | **50k–366k** identity rows; **enriched** profiles still need Marham/Oladoc/etc. |

**Pipeline role:** `doctor_sources = 'pmdc'` — **authority layer**, not primary listing source.

---

## Source 2 — Marham.pk

### What exists today

- **Product:** Largest PK doctor marketplace; **16,000+** doctors claimed on site (PMC/PMDC verified badge marketing)
- **Press / company:** up to **20,000** doctors, **155+ cities** (older PR); sitemaps list doctor URLs
- **API:** **None public**
- **Sitemaps:** `sitemap_doctors.xml`, `sitemap_doctors_1.xml`, `sitemap_special_city.xml`, etc.
- **robots.txt:** Broad `Disallow: /*?*`; blocks many bots; **allows sitemap discovery**

### Data typically available on profiles

Name, specialty, city, area, hospitals/clinics, fee, experience, ratings, PMDC number (sometimes), photo, profile URL, online consult flag.

### Acquisition options (ranked)

#### Option A — Commercial partnership / data license (RECOMMENDED)

**How:** Business development to Marham (B2B feed, affiliate API, or periodic export).

**Pitch angle:** HealthPilot sends **appointment intent / symptom-qualified leads**; Marham supplies **read-only doctor metadata** with attribution and deep links.

**Pros:** Compliant; rich fields; stable  
**Cons:** Cost or revenue share; negotiation time  
**Realistic yield:** **16k–20k** profiles

#### Option B — Sitemap-driven ingest (FALLBACK — legal review required)

**How:**

1. Fetch `https://www.marham.pk/sitemap_doctors.xml` (+ paginated variants)
2. Parse doctor profile URLs (no query strings per robots)
3. Polite fetch: **≤1 req/sec**, identifiable User-Agent, off-peak
4. Store raw JSON in `doctor_import_raw` → normalize → merge

**Risks:** Terms likely prohibit automated extraction; robots blocks SEO tools; Marham may block IP  
**Mitigation:** Written permission or legal opinion; stop on cease-and-desist

**Not recommended:** Apify/third-party scrapers for production — same legal issues, less control.

#### Option C — Manual / crowd import

CSV templates for hospital partnerships — slow, not nationwide.

### Marham estimated counts

| Measure | Count |
|---------|-------|
| Marham-listed doctors (marketing) | **16k–20k** |
| Unique after dedupe with Oladoc | **~10k–14k** |
| With fee + hospital + phone | **~12k–18k** |

**Pipeline:** `doctor_sources = 'marham'`, `source_url` = canonical Marham profile.

---

## Source 3 — Oladoc.com

### What exists today

- **Marketing:** **25,000+** doctors, **120+** specialties
- **API:** **None public**
- **Sitemaps:** `https://oladoc.com/sitemaps/sitemap_doctors` (+ locality, hospitals)
- **robots.txt:** Permissive for general crawlers; crawl-delay for some bots

### Data typically available

Name, specialty, city, hospitals, fee, experience, ratings, services, profile URL; sometimes availability.

### Acquisition options (ranked)

Same pattern as Marham:

1. **Partnership / license** (preferred) — contact corporate / BD via website
2. **Sitemap-guided ingest** (fallback, legal review)
3. Avoid unauthorized high-volume Apify actors in production

### Oladoc estimated counts

| Measure | Count |
|---------|-------|
| Oladoc-listed doctors | **20k–25k** |
| Overlap with Marham | **~50–70%** |
| Unique incremental vs Marham | **~5k–10k** |

**Pipeline:** `doctor_sources = 'oladoc'`.

---

## Source 4 — HamariWeb Health

### What exists today

- **Portal:** [health.hamariweb.com](https://health.hamariweb.com/doctors)
- **Structure:** City × specialty listing pages with **counts** (e.g. Karachi Dentist **5,263**; Lahore Dentist **3,413**)
- **Many profile images** served from `staticconnect.marham.pk` — suggests **Marham syndication/ partnership**, not independent primary data
- **robots.txt:** `Allow: /` (permissive)
- **API:** None public

### Acquisition options (ranked)

1. **Partnership with HamariWeb** (and clarify Marham relationship)
2. **Sitemap / listing crawl** — technically easier than Marham robots-wise; **ToS** still applies
3. Use HamariWeb mainly as **incremental** source when Marham/Oladoc miss a city/specialty

### HamariWeb estimated counts

| Measure | Count |
|---------|-------|
| Summed specialty counts (major cities, rough) | **~30k–50k** profile URLs |
| Likely unique vs Marham+Oladoc | **~3k–8k** incremental |
| Data quality | Medium (duplicate Marham entries common) |

**Pipeline:** `doctor_sources = 'hamariweb'`.

---

## Recommended hybrid pipeline (Phase B architecture)

```
┌─────────────────────────────────────────────────────────────────┐
│  ACQUISITION (lawful channels only)                              │
├──────────────┬──────────────┬──────────────┬──────────────────┤
│ PMDC MOU /   │ Marham       │ Oladoc       │ HamariWeb        │
│ verify API   │ license OR   │ license OR   │ license OR       │
│              │ sitemap*     │ sitemap*     │ sitemap*         │
└──────┬───────┴──────┬───────┴──────┬───────┴────────┬─────────┘
       │              │              │                │
       v              v              v                v
              doctor_import_raw (JSONB + source + external_id)
                              │
                              v
                    normalize.ts (specialty, name, city, fee)
                              │
                              v
                    dedupe.ts (pmdc > name+city+hospital)
                              │
                              v
              PMDC verification queue (pmdc_number / name match)
                              │
                              v
                    doctors (canonical) + verification_status
                              │
                              v
                    Find Doctors UI + symptom checker links

* sitemap path only after legal sign-off
```

### Merge & verification rules

| Condition | `verification_status` |
|-----------|------------------------|
| PMDC confirms active registration | `verified` |
| Same doctor on ≥2 sources (confidence ≥ threshold) | `cross_verified` |
| Doctor claims HealthPilot profile | `community_verified` |
| Single marketplace listing only | `unverified` |

### Dedupe keys (priority order)

1. `pmdc_number` (exact)
2. Normalized `full_name` + `city_slug` + `hospital_name` / `clinic_name`
3. Fuzzy name + specialty + city (Levenshtein / trigram — already have `pg_trgm` on name)

---

## Implementation phases (after legal go-ahead)

### B1 — Infrastructure (1–2 weeks)

- [ ] `pipeline/doctors/sources/pmdc-verify.ts` — single-record verifier (stub until MOU)
- [ ] `pipeline/doctors/sources/marham-sitemap.ts` — URL harvester
- [ ] `pipeline/doctors/sources/oladoc-sitemap.ts`
- [ ] `pipeline/doctors/sources/hamariweb-sitemap.ts`
- [ ] `pipeline/doctors/fetch-profile.ts` — shared polite HTTP client
- [ ] `pipeline/doctors/merge-to-doctors.ts` — raw → `doctors` upsert
- [ ] Cron / manual jobs: `npm run doctors:harvest -- --source marham`

### B2 — Licensed or approved ingest (2–4 weeks)

- [ ] First full import: Marham + Oladoc sitemaps **or** partner CSV
- [ ] Dedupe + merge; measure unique counts per city
- [ ] PMDC verification batch for rows with `pmdc_number`

### B3 — Quality & search (1–2 weeks)

- [ ] Language, gender, fee min/max filters in UI + RPC
- [ ] Symptom checker: directory doctors panel + facilities panel
- [ ] Empty-state coverage by city

### B4 — Ongoing

- [ ] Weekly delta import (new/changed profiles)
- [ ] Doctor claim flow → `community_verified`
- [ ] PMDC re-verification queue (expired licenses)

---

## Immediate decisions needed from you

1. **Legal budget:** Can we engage a PK healthcare/IT lawyer for Marham/Oladoc ToS review before any crawl?
2. **Partnership outreach:** Should HealthPilot contact Marham + Oladoc BD now (recommended parallel track)?
3. **PMDC MOU:** Proceed with formal verification-only MOU request?
4. **Risk tolerance:** If partnerships stall, approve **sitemap-only** fallback with attribution + deep links (no full content mirror)?

---

## Comparison: API vs export vs directory vs scrape

| Source | API | Bulk export | Public directory | Scraping |
|--------|-----|-------------|------------------|----------|
| PMDC | No | No (without MOU) | Search UI only | **Not recommended** |
| Marham | No | Partner only | Web profiles + sitemaps | **Fallback only** |
| Oladoc | No | Partner only | Web profiles + sitemaps | **Fallback only** |
| HamariWeb | No | Partner only | Listing pages | **Fallback only** (robots OK) |

---

## References (checked May 2026)

- PMDC online register & stats: https://online.pmdc.pk/ , https://pmdc.pk/
- Marham doctors positioning: https://www.marham.pk/doctors , robots.txt, sitemaps
- Oladoc homepage (25k+ doctors): https://oladoc.com/ , sitemaps
- HamariWeb doctors: https://health.hamariweb.com/doctors , city specialty counts
- Existing HealthPilot pipeline: `pipeline/doctors/`, migration `010_doctor_directory_expansion.sql`
