# Engineering decisions

Concise record of **why** the system is built this way — useful for code review and interviews.

## 1. Two discovery systems (doctors vs facilities)

| System | Data | Why |
|--------|------|-----|
| **Doctor directory** | Supabase `doctors` from Marham ingest | Rich profiles: fee, timings, specialty, booking |
| **Healthcare facilities** | Live OpenStreetMap Overpass | Nationwide coverage without maintaining a hospital database |

Mixing them confused users (“3.0 km” fake distances on doctors). They are separate UI routes and services.

## 2. Claude tool calling instead of free-form JSON

**Problem:** Urdu/English mixed output broke `JSON.parse`.  
**Solution:** Force tools `ask_follow_up` and `submit_symptom_analysis`; validate with Zod on the server.  
**Trade-off:** Extra prompt/tool schema maintenance; much higher reliability.

## 3. Edge functions as the AI gateway

**Problem:** Anthropic key cannot ship to the browser.  
**Solution:** All LLM calls via Supabase Edge Functions.  
**Benefits:** Central secrets, logging (`ai_traces`), rate limiting, RAG injection, model fallback.

## 4. Client-side triage before LLM

**Problem:** 1–3s LLM latency for emergency keywords.  
**Solution:** `symptomTriage.ts` runs locally in &lt;1ms.  
**Benefit:** Immediate severe/emergency UI hint; server still validates in final analysis.

## 5. GPS-first location

**Problem:** Profile city often wrong (e.g. registered Karachi, user in Lahore).  
**Solution:** `useCareLocation` prefers browser GPS → nearest city slug; OSM discovery uses coordinates first.  
**Doctor Near Me:** distances from resolved hospital/area/city coordinates (`doctorLocationResolve.ts`).

## 6. Marham ingest pipeline (not manual CSV)

**Problem:** Thousands of doctors; manual entry does not scale.  
**Solution:** `harvest → fetch → review → merge` with staging table `doctor_import_raw`.  
**Quality:** Repair jobs, city extraction from Area line, dedupe on upsert, exclude demo seed data.

## 7. PostGIS for directory search

**Problem:** Filter by city + specialty + fee + radius at scale.  
**Solution:** SQL RPCs `search_doctors_directory` and `doctors_within_radius` with indexes.  
**Benefit:** Single round-trip from app; fuzzy specialty matching in DB (migration `012`).

## 8. Publication gate

Doctors are not visible until `publication_status = 'published'` (set by `doctors:merge --publish`). Prevents half-parsed imports from reaching production.

## 9. Guest booking

**Problem:** Forcing login blocks rural users with symptom urgency.  
**Solution:** Public book route + `create_guest_appointment` RPC; optional WhatsApp handoff.

## 10. Testing strategy

| Layer | Tool |
|-------|------|
| Pure utils (triage, geo, parse) | Vitest |
| LLM behavior | `eval/` harness against real edge |
| UI | Manual + CI build |

No mocked Claude in unit tests — evals cover integration.

## 11. i18n from day one

`react-i18next` + `public/locales/en.json` / `ur.json`. Symptom chat supports EN/UR toggle; analysis returns `urdu_summary`.

## 12. CI pipeline

`.github/workflows/ci.yml`: `npm ci` → lint → test → build on every push to `main`.

## Anti-patterns we avoided

- Storing Anthropic keys in `VITE_*` env vars
- Using first `Rs.` on page as doctor fee (sidebar ads)
- Treating full-page HTML `includes('lahore')` as doctor city
- Showing Marham boilerplate as “professional statement”
- Generic 9–5 booking slots when Marham publishes weekly hours

## Further reading

- [architecture.md](./architecture.md)
- [AI_SYSTEMS.md](./AI_SYSTEMS.md)
- [DOCTOR_DIRECTORY.md](./DOCTOR_DIRECTORY.md)
