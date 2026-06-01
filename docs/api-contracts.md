# Edge function API contracts

Base URL: `{SUPABASE_URL}/functions/v1/{function-name}`

Headers for all calls:

```
Authorization: Bearer {SUPABASE_ANON_KEY}
apikey: {SUPABASE_ANON_KEY}
Content-Type: application/json
```

---

## `symptom-chat`

Multi-turn symptom conversation or forced final analysis.

### Request

```json
{
  "messages": [
    { "role": "user", "content": "chest pain for 2 hours" },
    { "role": "assistant", "content": "..." }
  ],
  "language": "en",
  "userAge": 45,
  "userGender": "male",
  "turnCount": 1,
  "forceFinalize": false
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `messages` | `{role, content}[]` | yes | `role`: `user` \| `assistant` |
| `language` | `"en"` \| `"ur"` | no | default `en` |
| `userAge` | number | no | |
| `userGender` | string | no | |
| `turnCount` | number | no | Used with message count to auto-finalize |
| `forceFinalize` | boolean | no | Skip follow-up; return analysis |

### Response — follow-up

```json
{
  "type": "follow_up",
  "message": "Does the pain spread to your arm or jaw?",
  "quick_severity": "severe",
  "trace_id": "uuid"
}
```

### Response — analysis

```json
{
  "type": "analysis",
  "analysis": {
    "primary_condition": "Chest pain",
    "condition_confidence": "medium",
    "brief_summary": "...",
    "possible_conditions": ["..."],
    "recommended_specialty": "Cardiology",
    "recommended_specialty_slug": "cardiology",
    "severity_level": "severe",
    "explanation": "...",
    "first_aid_tips": ["..."],
    "red_flags": ["..."],
    "disclaimer": "...",
    "urdu_summary": "..."
  },
  "trace_id": "uuid"
}
```

### Errors

| Status | Body |
|--------|------|
| 400 | `{ "error": "Messages required" }` |
| 500 | `{ "error": "..." }` |

---

## `analyze-symptoms`

Single-shot symptom analysis (used by eval harness).

### Request

```json
{
  "symptoms": "fever and rash for 3 days",
  "language": "en",
  "userAge": 30,
  "userGender": "female"
}
```

### Response

Flat analysis object (same fields as `analysis` above) + optional `trace_id`.

### Errors

| Status | Body |
|--------|------|
| 400 | `{ "error": "Symptoms text is required" }` |
| 500 | `{ "error": "..." }` |

---

## `discover-doctors`

Live OSM healthcare facility search.

### Request

```json
{
  "latitude": 31.5204,
  "longitude": 74.3587,
  "city": "lahore",
  "city_label": "Lahore",
  "radius_km": 25,
  "specialty": "cardiology",
  "area": "Gulberg",
  "hospital": "Mayo Hospital",
  "use_gps": true
}
```

| Field | Type | Notes |
|-------|------|-------|
| `latitude` / `longitude` | number | Preferred; city center used if omitted |
| `city` | string | Slug e.g. `lahore` |
| `specialty` | string | Slug filter |
| `use_gps` | boolean | Metadata for search mode |

### Response

```json
{
  "results": [ { "id": "osm-node-123", "full_name": "...", "facility_type": "hospital", ... } ],
  "meta": {
    "mode": "gps",
    "latitude": 31.52,
    "longitude": 74.36,
    "radius_km": 25,
    "facility_count": 12,
    "specialty_filter": "cardiology",
    "data_source": "openstreetmap"
  }
}
```

---

## `get-facility`

Single facility by OSM id.

### Request

```json
{
  "osm_type": "node",
  "osm_id": "5255424740"
}
```

### Response

```json
{
  "facility": { ... } 
}
```

`facility` is `null` if not found.

---

## Specialty slugs (enum)

`general`, `cardiology`, `dermatology`, `orthopedics`, `gynecology`, `pediatrics`, `neurology`, `ent`, `ophthalmology`, `psychiatry`, `urology`, `gastroenterology`, `endocrinology`, `pulmonology`

## Severity levels

`mild`, `moderate`, `severe`, `emergency`
