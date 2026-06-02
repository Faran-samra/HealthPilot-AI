# HealthPilot AI — Documentation

Start here after reading the [main README](../README.md).

## For recruiters & product reviewers

| Document | What you will learn |
|----------|---------------------|
| [../README.md](../README.md) | 30-second overview, architecture diagram, repo map |
| [architecture.md](./architecture.md) | User flows: symptom → doctors → facilities |
| [safety.md](./safety.md) | Why this is not a diagnosis product |

## For engineers & technical interviewers

| Document | What you will learn |
|----------|---------------------|
| [AI_SYSTEMS.md](./AI_SYSTEMS.md) | Claude tool calling, schemas, RAG, evals, observability |
| [DOCTOR_DIRECTORY.md](./DOCTOR_DIRECTORY.md) | Marham pipeline, merge, PostGIS search |
| [ENGINEERING.md](./ENGINEERING.md) | Design decisions with trade-offs |
| [api-contracts.md](./api-contracts.md) | Edge function request/response shapes |
| [SETUP.md](./SETUP.md) | Local dev, secrets, deploy checklist |

## Pipelines & services

| Path | Description |
|------|-------------|
| [../pipeline/doctors/README.md](../pipeline/doctors/README.md) | Doctor ingest CLI |
| [nhs-pipeline.md](./nhs-pipeline.md) | NHS → Pakistan medical RAG |
| [../services/embedding-api/README.md](../services/embedding-api/README.md) | FastAPI BGE embedding service |
| [eval-results.md](./eval-results.md) | LLM evaluation notes |

## Planning (historical)

| Document | Description |
|----------|-------------|
| [plans/doctor-directory-expansion.md](./plans/doctor-directory-expansion.md) | Phase A/B directory rollout |
| [plans/phase-b-doctor-data-acquisition.md](./plans/phase-b-doctor-data-acquisition.md) | Data acquisition strategy |
| [plans/HealthPilot_AI_CV_Implementation_Plan.md](./plans/HealthPilot_AI_CV_Implementation_Plan.md) | LLMOps / CV roadmap |
