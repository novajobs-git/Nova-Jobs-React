"""Embed every normalized job title in the pool once (spec 014).

Writes data/jobs/title-embeddings.json: gemini-embedding-001, 768 dims,
L2-normalized, base64 float32 keyed by normalized title. Only titles not
already in the cache are sent, so re-runs cost nothing unless titles change.
Titles no longer in the pool are pruned.

Run from the repo root (after scripts.extract_requirements):
    .venv\\Scripts\\python -m scripts.embed_titles
"""

from __future__ import annotations

import json
import os
from pathlib import Path

from engine.gemini import EMBED_DIMS, EMBED_MODEL, embed, pack
from scripts.ats.requirements import normalize_title

DATA = Path(__file__).resolve().parent.parent / "data" / "jobs"
POOL = DATA / "us-jobs.json"
CACHE = DATA / "title-embeddings.json"
CHUNK = 500  # saved after every chunk, so an interrupted run keeps its progress


def save(cache: dict) -> None:
    tmp = CACHE.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(cache), encoding="utf-8")
    os.replace(tmp, CACHE)


def main() -> None:
    jobs = json.loads(POOL.read_text(encoding="utf-8"))["jobs"]
    titles = {j.get("titleNormalized") or normalize_title(j["title"]) for j in jobs} - {""}

    cache = json.loads(CACHE.read_text(encoding="utf-8")) if CACHE.exists() else {}
    if cache.get("model") != EMBED_MODEL or cache.get("dims") != EMBED_DIMS:
        cache = {"model": EMBED_MODEL, "dims": EMBED_DIMS, "titles": {}}
    stale = set(cache["titles"]) - titles
    for t in stale:
        del cache["titles"][t]

    todo = sorted(titles - set(cache["titles"]))
    print(f"{len(titles)} unique titles; {len(todo)} to embed, {len(stale)} pruned")
    for i in range(0, len(todo), CHUNK):
        chunk = todo[i : i + CHUNK]
        for title, vector in zip(chunk, embed(chunk)):
            cache["titles"][title] = pack(vector)
        save(cache)
        print(f"  {min(i + CHUNK, len(todo))}/{len(todo)}")
    save(cache)


if __name__ == "__main__":
    main()
