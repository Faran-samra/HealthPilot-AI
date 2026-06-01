"""Embeddings via Hugging Face Inference API (no local model)."""

from __future__ import annotations

import os
import time
from typing import Any

import httpx

MODEL_ID = os.getenv("HF_EMBEDDING_MODEL", "BAAI/bge-large-en-v1.5")
EMBEDDING_DIM = 1024
MAX_CHARS = 2000
HF_API = "https://api-inference.huggingface.co/pipeline/feature-extraction"


def _api_key() -> str:
    key = os.getenv("HUGGINGFACE_API_KEY") or os.getenv("HF_TOKEN")
    if not key:
        raise ValueError("HUGGINGFACE_API_KEY or HF_TOKEN required")
    return key


def _l2_normalize(vec: list[float]) -> list[float]:
    norm = sum(x * x for x in vec) ** 0.5 or 1.0
    return [x / norm for x in vec]


def _to_sentence_embedding(raw: Any) -> list[float]:
    if not isinstance(raw, list) or not raw:
        raise ValueError("Invalid HF embedding response")

    if isinstance(raw[0], (int, float)):
        return _l2_normalize([float(x) for x in raw])

    if isinstance(raw[0], list) and raw[0] and isinstance(raw[0][0], (int, float)):
        tokens: list[list[float]] = [[float(x) for x in row] for row in raw]
        dim = len(tokens[0])
        summed = [0.0] * dim
        for tok in tokens:
            for i in range(dim):
                summed[i] += tok[i]
        n = float(len(tokens)) or 1.0
        return _l2_normalize([x / n for x in summed])

    raise ValueError("Unexpected HF embedding shape")


def _parse_batch(data: Any, count: int) -> list[list[float]]:
    if not isinstance(data, list):
        raise ValueError("Invalid HF batch response")
    if count == 1 and data and (isinstance(data[0], (int, float)) or isinstance(data[0], list)):
        return [_to_sentence_embedding(data)]
    return [_to_sentence_embedding(item) for item in data]


def encode_texts(texts: list[str]) -> list[list[float]]:
    if not texts:
        return []

    url = f"{HF_API}/{MODEL_ID}"
    headers = {"Authorization": f"Bearer {_api_key()}"}
    inputs = [t[:MAX_CHARS] for t in texts]

    for attempt in range(9):
        with httpx.Client(timeout=120.0) as client:
            res = client.post(url, headers=headers, json={"inputs": inputs})

        if res.status_code == 200:
            vectors = _parse_batch(res.json(), len(inputs))
            for v in vectors:
                if len(v) != EMBEDDING_DIM:
                    raise ValueError(f"Expected {EMBEDDING_DIM} dims, got {len(v)}")
            return vectors

        body = res.text
        if res.status_code == 503 or "loading" in body.lower():
            wait = 10
            if attempt < 8:
                time.sleep(wait)
                continue

        raise RuntimeError(f"HuggingFace failed: {res.status_code} {body[:400]}")

    raise RuntimeError("HuggingFace failed after retries")
