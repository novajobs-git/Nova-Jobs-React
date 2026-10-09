"""Gemini over REST, shared by the apply engine (screening answers) and job
ingestion (requirement extraction + title embeddings, spec 014). Same call
pattern as before: the key from .env, retries on 429, the key sent in a
header so it never lands in a logged URL."""

from __future__ import annotations

import base64
import json
import math
import os
import struct
import time

import requests
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-flash-lite-latest")
GEMINI_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"

EMBED_MODEL = "gemini-embedding-001"
EMBED_DIMS = 768
EMBED_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{EMBED_MODEL}:batchEmbedContents"
EMBED_BATCH = 100


def _post(url: str, body: dict, timeout: int, attempts: int = 5) -> dict:
    if not GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY is not set")
    for attempt in range(attempts):
        resp = requests.post(url, headers={"x-goog-api-key": GEMINI_API_KEY}, json=body, timeout=timeout)
        if resp.status_code in (429, 500, 503) and attempt < attempts - 1:
            time.sleep(5 * (attempt + 1))
            continue
        resp.raise_for_status()
        return resp.json()
    raise RuntimeError("unreachable")


def generate_json(prompt: str, schema: dict, timeout: int = 30) -> dict:
    """One structured-output call; the reply is parsed against `schema` by Gemini itself."""
    data = _post(
        GEMINI_URL,
        {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"responseMimeType": "application/json", "responseSchema": schema, "temperature": 0},
        },
        timeout,
    )
    return json.loads(data["candidates"][0]["content"]["parts"][0]["text"])


def embed(texts: list[str]) -> list[list[float]]:
    """L2-normalized embeddings (768-dim output is not normalized by the API), in input order."""
    vectors: list[list[float]] = []
    for i in range(0, len(texts), EMBED_BATCH):
        body = {
            "requests": [
                {
                    "model": f"models/{EMBED_MODEL}",
                    "content": {"parts": [{"text": t}]},
                    "taskType": "SEMANTIC_SIMILARITY",
                    "outputDimensionality": EMBED_DIMS,
                }
                for t in texts[i : i + EMBED_BATCH]
            ]
        }
        for e in _post(EMBED_URL, body, timeout=60)["embeddings"]:
            v = e["values"]
            n = math.sqrt(sum(x * x for x in v)) or 1.0
            vectors.append([x / n for x in v])
    return vectors


def pack(vector: list[float]) -> str:
    """base64 little-endian float32, the format lib/matching/embeddings.ts decodes."""
    return base64.b64encode(struct.pack(f"<{len(vector)}f", *vector)).decode("ascii")
