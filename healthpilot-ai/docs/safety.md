# Safety & medical disclaimers

## Product positioning

HealthPilot AI is an **informational navigation assistant**, not:

- A licensed medical device
- A diagnostic system
- A substitute for emergency services or clinical judgment

All AI outputs include disclaimers directing users to qualified providers. Emergency flows surface **Rescue 1122** and **Edhi 115**.

## Technical guardrails

| Layer | Mechanism |
|-------|-----------|
| Prompting | “Never diagnose”; gather info; Pakistan emergency numbers |
| Tool schema | Required `disclaimer`, `red_flags`, `severity_level` |
| Zod validation | Reject/retry malformed LLM tool payloads |
| `safety.ts` | Post-process: emergency → non-empty red flags; block definitive diagnosis phrases |
| Client triage | Keyword-based emergency detection before API call |

## Privacy & logging

- `ai_traces` stores model, latency, token counts — **not** full symptom text by default.
- Link feedback to `trace_id` without storing PHI in comments (user education in UI).

## User-facing copy

Always visible on symptom checker:

> This is NOT a medical diagnosis. Consult a qualified doctor or visit the nearest hospital. In an emergency, call Rescue 1122 or Edhi 115.

## Eval & monitoring

- Gold dataset in `eval/cases.jsonl` with expected severity and specialty.
- Target: ≥95% emergency recall on eval set before releases.
- Human thumbs feedback in `analysis_feedback` for continuous improvement.

## What we do not do

- Prescribe medication or dosages
- State “you have [disease]” as fact
- Replace triage by trained clinicians in emergencies
