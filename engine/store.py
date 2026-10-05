"""Local files shared with the Next.js app (spec 012). Stand-ins for Supabase tables until spec 008.

Ownership keeps the two processes from overwriting each other:
- data/engine/settings.json      written by the app (the Auto-Apply toggle and the Settings page)
- data/applications/inbox/*.json written by the app, one file per job the candidate clicked Apply on
- data/applications/candidate.json and data/engine/status.json  written only by the engine
"""

from __future__ import annotations

import json
import os
import time
from pathlib import Path
from typing import Any

DATA = Path(__file__).resolve().parent.parent / "data"
SETTINGS = DATA / "engine" / "settings.json"
STATUS = DATA / "engine" / "status.json"
APPLICATIONS = DATA / "applications" / "candidate.json"
INBOX = DATA / "applications" / "inbox"
PROFILE = DATA / "profiles" / "candidate.json"
MATCHES = DATA / "matches" / "candidate.json"
POOL = DATA / "jobs" / "us-jobs.json"

CANDIDATE_ID = "candidate"  # one demo candidate until Clerk


def read_json(path: Path, default: Any) -> Any:
    for _ in range(5):
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except FileNotFoundError:
            return default
        except (PermissionError, json.JSONDecodeError):
            time.sleep(0.1)  # the other process is mid-write
    return default


def write_json(path: Path, value: Any) -> None:
    """Atomic: readers see the old file or the new one, never half of one."""
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(f".{os.getpid()}.tmp")
    tmp.write_text(json.dumps(value, indent=1, ensure_ascii=False), encoding="utf-8")
    for attempt in range(20):
        try:
            os.replace(tmp, path)
            return
        except PermissionError:  # Windows: a reader has the file open
            time.sleep(0.05 * (attempt + 1))
    os.replace(tmp, path)


def settings() -> dict:
    return {"enabled": False, "autoApplyMatches": False, **read_json(SETTINGS, {})}
