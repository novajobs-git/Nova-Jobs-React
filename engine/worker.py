"""Auto-Apply worker (spec 012): applies to queued jobs one at a time.

Started by the app when the candidate turns Auto-Apply on, and exits after
the current application once it is turned off. Run it by hand to watch the
log:
    .venv\\Scripts\\python -m engine.worker

Each loop: take new Apply clicks from the inbox, queue new matches if the
candidate allowed that in Settings, then apply to the oldest queued job.
"""

from __future__ import annotations

import os
import random
import sys
import threading
import time
from datetime import date, datetime, timezone

from engine.store import (
    APPLICATIONS, CANDIDATE_ID, DATA, INBOX, MATCHES, POOL, PROFILE, STATUS,
    read_json, settings, write_json,
)

DAILY_LIMIT = int(os.getenv("DAILY_LIMIT", "40"))
HEARTBEAT_S = 5
STALE_S = 20
STEPS = ["Opening the posting", "Filling the application form", "Submitting"]

_status_lock = threading.Lock()
_status: dict = {}


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def set_status(**fields) -> None:
    with _status_lock:
        _status.update(fields, pid=os.getpid(), heartbeatAt=now())
        write_json(STATUS, _status)


def heartbeat() -> None:
    while True:
        time.sleep(HEARTBEAT_S)
        set_status()


def another_worker_running() -> bool:
    current = read_json(STATUS, {})
    if current.get("pid") in (None, os.getpid()) or current.get("state") == "off":
        return False
    try:
        age = time.time() - datetime.fromisoformat(current["heartbeatAt"]).timestamp()
    except (KeyError, ValueError):
        return False
    return age < STALE_S


def load_applications() -> list[dict]:
    return read_json(APPLICATIONS, {"applications": []})["applications"]


def save_applications(apps: list[dict]) -> None:
    write_json(APPLICATIONS, {"applications": apps})


def take_inbox(apps: list[dict]) -> list[dict]:
    """Apply clicks from the app become queued applications."""
    known = {a["jobId"] for a in apps}
    files = sorted(INBOX.glob("*.json")) if INBOX.exists() else []
    for f in files:
        item = read_json(f, None)
        if item and item.get("jobId") not in known:
            apps.append(item)
            known.add(item["jobId"])
        f.unlink(missing_ok=True)
    return apps


def queue_matches(apps: list[dict]) -> list[dict]:
    """"Apply to matches automatically": queue the best untouched matches, up to today's remaining limit."""
    room = DAILY_LIMIT - applied_today(apps) - sum(a["status"] in ("queued", "applying") for a in apps)
    if room <= 0:
        return apps
    known = {a["jobId"] for a in apps}
    pool = {j["id"]: j for j in read_json(POOL, {"jobs": []})["jobs"]}
    matches = sorted(read_json(MATCHES, {"matches": []})["matches"], key=lambda m: -m["score"])
    stamp = time.time()
    for i, m in enumerate(m for m in matches if m["jobId"] not in known and m["jobId"] in pool):
        if i >= room:
            break
        job = pool[m["jobId"]]
        queued_at = datetime.fromtimestamp(stamp + i / 1000, timezone.utc).isoformat()
        apps.append({
            "id": f"app_{job['id']}",
            "jobId": job["id"],
            "company": job["company"],
            "role": job["title"],
            "location": job["location"],
            "ats": job["ats"],
            "matchScore": m["score"],
            "sponsorship": "unknown",
            "status": "queued",
            "queuedAt": queued_at,
            "updatedAt": queued_at,
            "postingUrl": job["url"],
            "autoQueued": True,
        })
    return apps


def applied_today(apps: list[dict]) -> int:
    today = date.today().isoformat()
    return sum(a["status"] == "applied" and a["updatedAt"][:10] == today for a in apps)


def next_queued(apps: list[dict]) -> dict | None:
    queued = [a for a in apps if a["status"] == "queued"]
    return min(queued, key=lambda a: a["queuedAt"]) if queued else None


def update(job_id: str, **fields) -> None:
    apps = load_applications()
    for a in apps:
        if a["jobId"] == job_id:
            a.update(fields, updatedAt=now())
            if a["status"] != "applying":
                a.pop("progress", None)
    save_applications(apps)


def run() -> None:
    if another_worker_running():
        print("[Worker] Another engine is already running. Exiting.")
        return
    set_status(state="starting", message="Starting", jobId=None, startedAt=now())
    threading.Thread(target=heartbeat, daemon=True).start()

    # Imported late: Playwright is slow to load, and the app waits for the first heartbeat.
    from engine.apply import apply_to_job

    # A job left "applying" by a crash goes back to the front of the queue.
    apps = load_applications()
    for a in apps:
        if a["status"] == "applying":
            a.update(status="queued", updatedAt=now())
            a.pop("progress", None)
    save_applications(apps)

    while True:
        s = settings()
        if not s["enabled"]:
            set_status(state="off", message="Auto-Apply is off", jobId=None)
            print("[Worker] Auto-Apply turned off. Exiting.")
            return

        apps = take_inbox(load_applications())
        if s["autoApplyMatches"]:
            apps = queue_matches(apps)
        save_applications(apps)

        if applied_today(apps) >= DAILY_LIMIT:
            set_status(state="limit", message=f"Daily limit reached ({DAILY_LIMIT} applications). Resumes tomorrow.", jobId=None)
            time.sleep(30)
            continue

        job = next_queued(apps)
        if not job:
            set_status(state="idle", message="Waiting for jobs in the queue", jobId=None)
            time.sleep(4)
            continue

        profile = read_json(PROFILE, None)
        resume = DATA / profile["resume_pdf"] if profile and profile.get("resume_pdf") else None
        if not profile or not resume or not resume.exists():
            update(job["jobId"], status="failed", reason="No stored resume. Finish onboarding before Auto-Apply can send applications.", resolution="update_profile")
            continue

        print(f"\n[Worker] Applying: {job['role']} at {job['company']} ({job['ats']})")

        def report(step: str, job_id: str = job["jobId"]) -> None:
            current = next((i + 1 for i, s_ in enumerate(STEPS) if step.startswith(s_)), 2)
            update(job_id, status="applying", progress={"step": step, "current": current, "total": len(STEPS)})
            set_status(state="applying", message=step, jobId=job_id)
            print(f"[Worker]   {step}")

        report(STEPS[0])
        status, reason = apply_to_job(job, profile, str(resume), CANDIDATE_ID, report)
        fields = {"status": status}
        if status == "applied":
            fields.update(reason=None, resolution=None)
        else:
            fields.update(reason=reason, resolution="retry" if status == "failed" else "dismiss")
        update(job["jobId"], **fields)
        print(f"[Worker]   -> {status}{': ' + reason if reason else ''}")
        time.sleep(random.uniform(2, 4))


if __name__ == "__main__":
    try:
        run()
    except KeyboardInterrupt:
        set_status(state="off", message="Engine stopped", jobId=None)
        sys.exit(0)
