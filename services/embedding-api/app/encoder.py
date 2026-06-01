"""BGE-large-en-v1.5 — must match Node ingest (Xenova/bge-large-en-v1.5, 1024d, normalized)."""

from __future__ import annotations

from sentence_transformers import SentenceTransformer

MODEL_ID = "BAAI/bge-large-en-v1.5"
EMBEDDING_DIM = 1024
MAX_CHARS = 8000

_model: SentenceTransformer | None = None


def get_model() -> SentenceTransformer:
    global _model
    if _model is None:
        _model = SentenceTransformer(MODEL_ID)
    return _model


def encode_texts(texts: list[str]) -> list[list[float]]:
    """Plain encode (no query/passage prefix) to stay compatible with corpus ingest."""
    if not texts:
        return []
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
