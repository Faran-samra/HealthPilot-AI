"""BGE-large-en-v1.5 — must match Node ingest (Xenova/bge-large-en-v1.5, 1024d, normalized)."""

from __future__ import annotations

import threading

from sentence_transformers import SentenceTransformer

MODEL_ID = "BAAI/bge-large-en-v1.5"
EMBEDDING_DIM = 1024
MAX_CHARS = 8000

_model: SentenceTransformer | None = None
_load_lock = threading.Lock()
_model_ready = False
_model_error: str | None = None


def is_model_ready() -> bool:
    return _model_ready


def model_error() -> str | None:
    return _model_error


def get_model() -> SentenceTransformer:
    global _model
    if _model is None:
        with _load_lock:
            if _model is None:
                _model = SentenceTransformer(MODEL_ID)
    return _model


def warmup_model() -> None:
    """Load model + one encode (runs in background thread on startup)."""
    global _model_ready, _model_error
    try:
        encode_texts(["warmup"])
        _model_ready = True
    except Exception as e:
        _model_error = str(e)
        raise


def encode_texts(texts: list[str]) -> list[list[float]]:
    if not texts:
        return []
    if not _model_ready and _model is None:
        warmup_model()
    model = get_model()
    trimmed = [t[:MAX_CHARS] for t in texts]
    vectors = model.encode(
        trimmed,
        normalize_embeddings=True,
        show_progress_bar=False,
        convert_to_numpy=True,
    )
    out: list[list[float]] = []
    for row in vectors:
        vec = row.tolist()
        if len(vec) != EMBEDDING_DIM:
            raise ValueError(f"Expected {EMBEDDING_DIM} dimensions, got {len(vec)}")
        out.append(vec)
    return out
