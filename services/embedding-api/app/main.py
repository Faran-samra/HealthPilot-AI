"""Lightweight embedding API — proxies to Hugging Face Inference (no local ML model)."""

from __future__ import annotations

import os
from typing import Annotated

from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from app.encoder import EMBEDDING_DIM, MODEL_ID, encode_texts

API_KEY = os.getenv("EMBEDDING_API_KEY", "").strip()
MAX_BATCH = int(os.getenv("EMBED_MAX_BATCH", "16"))

app = FastAPI(
    title="HealthPilot Embedding API",
    version="2.0.0",
    description="HF Inference proxy for BGE-large 1024d embeddings",
)


class EmbedRequest(BaseModel):
    query: str | None = None
    texts: list[str] | None = None


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


@app.get("/")
def root() -> dict:
    return {
        "service": "HealthPilot Embedding API",
        "backend": "huggingface-inference",
        "model": MODEL_ID,
        "health": "/health",
        "embed": "POST /embed",
    }


@app.get("/health")
def health() -> dict:
    has_hf = bool(os.getenv("HUGGINGFACE_API_KEY") or os.getenv("HF_TOKEN"))
    return {
        "status": "ok",
        "model": MODEL_ID,
        "dimensions": EMBEDDING_DIM,
        "backend": "huggingface-inference",
        "hf_configured": has_hf,
        "auth_required": bool(API_KEY),
    }


@app.post("/embed", response_model=EmbedResponse, dependencies=[Depends(verify_api_key)])
def embed(body: EmbedRequest) -> EmbedResponse:
    if body.query is not None and body.texts is not None:
        raise HTTPException(status_code=400, detail="Send either query or texts, not both")

    try:
        if body.query is not None:
            vectors = encode_texts([body.query])
            return EmbedResponse(embedding=vectors[0])

        if body.texts is not None:
            if not body.texts:
                raise HTTPException(status_code=400, detail="texts must not be empty")
            if len(body.texts) > MAX_BATCH:
                raise HTTPException(status_code=400, detail=f"Maximum {MAX_BATCH} texts per request")
            return EmbedResponse(embeddings=encode_texts(body.texts))
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e

    raise HTTPException(status_code=400, detail='Send {"query": "..."} or {"texts": ["..."]}')
