# LLM evaluation results

> Auto-updated by `npm run eval`. Last run: _not yet run_

## Summary

| Metric | Value |
|--------|-------|
| Cases run | — |
| Specialty exact match | — |
| Severity exact match | — |
| Emergency recall | — |
| JSON / schema valid | — |
| Latency p50 (ms) | — |
| Latency p95 (ms) | — |

## By language

| Language | Cases | Specialty acc. | Severity acc. | Emergency recall |
|----------|-------|----------------|---------------|------------------|
| en | — | — | — | — |
| ur | — | — | — | — |

## Notes

Run locally:

```bash
export VITE_SUPABASE_URL=...
export VITE_SUPABASE_ANON_KEY=...
npm run eval
```

Optional: `--sample 10` for a quick smoke test.

## RAG ablation

_Compare before/after RAG once Phase D is enabled._

| Config | Specialty acc. | Emergency recall |
|--------|----------------|------------------|
| Baseline | — | — |
| + RAG | — | — |
