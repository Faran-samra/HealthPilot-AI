# Contributing

Thank you for your interest in HealthPilot AI.

## Development setup

See [docs/SETUP.md](./docs/SETUP.md).

## Before opening a PR

```bash
npm run lint
npm run test
npm run build
```

CI runs the same checks on `main`.

## Project areas

| Area | Path |
|------|------|
| Frontend | `src/` |
| Edge functions | `supabase/functions/` |
| Doctor ingest | `pipeline/doctors/` |
| NHS / RAG | `pipeline/nhs/` |
| Docs | `docs/` |

## Documentation

When changing behavior, update the relevant doc in `docs/` and link from [docs/README.md](./docs/README.md).

## Medical / safety

Do not remove disclaimers or present AI output as diagnosis. See [docs/safety.md](./docs/safety.md).

## Questions

Open a GitHub issue with context and reproduction steps.
