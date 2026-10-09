"""Local files shared with the Next.js app (spec 012). Stand-ins for Supabase tables until spec 008.

Everything is per candidate (`Candidate(id)`), so each candidate's Auto-Apply
settings, queue and engine are their own:
- data/engine/settings/<id>.json   written by the app (Auto-Apply toggle, Settings page)
- data/engine/status/<id>.json     written by that candidate's engine (heartbeat + what it is doing)
- data/applications/<id>.json      written by both, only inside `mutate()` (the <id>.lock file
                                   serializes the app's and the engine's read-modify-writes)
"""

from __future__ import annotations

import json
import os
import time
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Iterator, TypeVar

DATA = Path(__file__).resolve().parent.parent / "data"
POOL = DATA / "jobs" / "us-jobs.json"
STALE_LOCK_S = 10

# What a candidate gets before they change anything in Settings.
DEFAULT_SETTINGS = {"enabled": False, "autoApplyMatches": False, "autoSubmit": False}

T = TypeVar("T")


@dataclass(frozen=True)
class Candidate:
    """One candidate's files. The id is "candidate" until Clerk user ids exist."""

    id: str

    @property
    def settings_file(self) -> Path:
        return DATA / "engine" / "settings" / f"{self.id}.json"

    @property
    def status_file(self) -> Path:
        return DATA / "engine" / "status" / f"{self.id}.json"

    @property
    def applications_file(self) -> Path:
        return DATA / "applications" / f"{self.id}.json"

    @property
    def lock_file(self) -> Path:
        return DATA / "applications" / f"{self.id}.lock"

    @property
    def profile_file(self) -> Path:
        return DATA / "profiles" / f"{self.id}.json"

    @property
    def matches_file(self) -> Path:
        return DATA / "matches" / f"{self.id}.json"

    def settings(self) -> dict:
        return {**DEFAULT_SETTINGS, **read_json(self.settings_file, {})}

    def load_applications(self) -> list[dict]:
        return read_json(self.applications_file, {"applications": []})["applications"]

    def mutate(self, fn: Callable[[list[dict]], T]) -> T:
        """Read, change and save this candidate's applications under the shared lock."""
        with _locked(self.lock_file):
            apps = self.load_applications()
            result = fn(apps)
            write_json(self.applications_file, {"applications": apps})
            return result


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


@contextmanager
def _locked(lock: Path) -> Iterator[None]:
    lock.parent.mkdir(parents=True, exist_ok=True)
    deadline = time.time() + 10
    while True:
        try:
            fd = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
            break
        except FileExistsError:
            try:
                if time.time() - lock.stat().st_mtime > STALE_LOCK_S:
                    lock.unlink(missing_ok=True)  # left by a crashed process
                    continue
            except FileNotFoundError:
                continue
            if time.time() > deadline:
                raise TimeoutError("The applications file stayed locked for 10 seconds.")
            time.sleep(0.05)
    try:
        yield
    finally:
        os.close(fd)
        lock.unlink(missing_ok=True)
