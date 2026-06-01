"""Production embedding API for HealthPilot RAG (Supabase Edge → HTTPS)."""

from __future__ import annotations

import os
import threading

from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field
from typing import Annotated

from app.encoder import (
    EMBEDDING_DIM,
    MODEL_ID,
    encode_texts,
    is_model_ready,
    model_error,
    warmup_model,
)

API_KEY = os.getenv("EMBEDDING_API_KEY", "").strip()
MAX_BATCH = int(os.getenv("EMBED_MAX_BATCH", "64"))

app = FastAPI(
    title="HealthPilot Embedding API",
    version="1.0.0",
    description="BGE-large 1024d vectors for medical_chunks RAG",
)


@app.on_event("startup")
def start_background_warmup() -> None:
    """Do not block startup — Railway healthcheck needs /health within seconds."""

    def _run() -> None:
        try:
            warmup_model()
        except Exception:
            pass  # model_error() exposed via /health

    threading.Thread(target=_run, daemon=True).start()


class EmbedRequest(BaseModel):
    query: str | None = Field(None, description="Single query string for RAG retrieval")
    texts: list[str] | None = Field(None, description="Batch of document strings")


class EmbedResponse(BaseModel):
    embedding: list[float] | None = None
    embeddings: list[list[float]] | None = None


def verify_api_key(
    authorization: Annotated[str | None, Header()] = None,
    x_embedding_key: Annotated[str | None, Header(alias="X-Embedding-Key")] = None,
) -> None:
    if not API_KEY:
        return
    token: str | None = None
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization[7:].strip()
    elif x_embedding_key:
        token = x_embedding_key.strip()
    if token != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")


def require_model_ready() -> None:
    if is_model_ready():
        return
    err = model_error()
    if err:
        raise HTTPException(status_code=503, detail=f"Model failed to load: {err}")
    raise HTTPException(
        status_code=503,
        detail="Model is still loading (first deploy may take 1–2 minutes). Retry shortly.",
    )


@app.get("/")
def root() -> dict:
    return {
        "service": "HealthPilot Embedding API",
        "health": "/health",
        "embed": "POST /embed",
    }


@app.get("/health")
def health() -> dict:
    """Always returns 200 once uvicorn is up (Railway liveness)."""
    ready = is_model_ready()
    body = {
        "status": "ok" if ready else "starting",
        "model": MODEL_ID,
        "dimensions": EMBEDDING_DIM,
        "model_loaded": ready,
        "auth_required": bool(API_KEY),
    }
    if err := model_error():
        body["error"] = err
    return body


@app.post("/embed", response_model=EmbedResponse, dependencies=[Depends(verify_api_key)])
def embed(body: EmbedRequest) -> EmbedResponse:
    require_model_ready()

    if body.query is not None and body.texts is not None:
        raise HTTPException(status_code=400, detail="Send either query or texts, not both")

    if body.query is not None:
        vectors = encode_texts([body.query])
        return EmbedResponse(embedding=vectors[0])

    if body.texts is not None:
        if len(body.texts) == 0:
            raise HTTPException(status_code=400, detail="texts must not be empty")
        if len(body.texts) > MAX_BATCH:
            raise HTTPException(
                status_code=400,
                detail=f"Maximum {MAX_BATCH} texts per request",
            )
        return EmbedResponse(embeddings=encode_texts(body.texts))

    raise HTTPException(status_code=400, detail='Send {"query": "..."} or {"texts": ["..."]}')
