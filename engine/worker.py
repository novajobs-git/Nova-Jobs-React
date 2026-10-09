"""Auto-Apply worker (spec 012): applies to ONE candidate's queued jobs, one at a time.

The app starts one worker per candidate when that candidate turns Auto-Apply
on; it exits after the current application once they turn it off. Every
setting it follows is that candidate's own (data/engine/settings/<id>.json).
Run it by hand to watch the log:
    .venv\\Scripts\\python -m engine.worker --candidate candidate

Each loop: queue new matches if the candidate allowed that in Settings,
then apply to their oldest queued job. Paused jobs are skipped. Pausing or
cancelling the job being applied to stops it at the next step.
"""

from __future__ import annotations

import argparse
import os
import random
import sys
import threading
import time
from datetime import date, datetime, timezone

from engine.store import DATA, POOL, Candidate, read_json, write_json

DAILY_LIMIT = int(os.getenv("DAILY_LIMIT", "40"))
HEARTBEAT_S = 5
STALE_S = 20
STEPS = ["Opening the posting", "Filling the application form", "Submitting"]

_status_lock = threading.Lock()
_status: dict = {}


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def set_status(c: Candidate, **fields) -> None:
    with _status_lock:
        _status.update(fields, pid=os.getpid(), candidateId=c.id, heartbeatAt=now())
        write_json(c.status_file, _status)


def heartbeat(c: Candidate) -> None:
    while True:
        time.sleep(HEARTBEAT_S)
        set_status(c)


def another_worker_running(c: Candidate) -> bool:
    current = read_json(c.status_file, {})
    if current.get("pid") in (None, os.getpid()) or current.get("state") == "off":
        return False
    try:
        age = time.time() - datetime.fromisoformat(current["heartbeatAt"]).timestamp()
    except (KeyError, ValueError):
        return False
    return age < STALE_S


def applied_today(apps: list[dict]) -> int:
    today = date.today().isoformat()
    return sum(a["status"] == "applied" and a["updatedAt"][:10] == today for a in apps)


def queue_matches(c: Candidate, apps: list[dict]) -> None:
    """"Apply to matches automatically": queue the best untouched matches, up to today's remaining limit."""
    room = DAILY_LIMIT - applied_today(apps) - sum(a["status"] in ("queued", "applying") for a in apps)
    if room <= 0:
        return
    known = {a["jobId"] for a in apps}
    pool = {j["id"]: j for j in read_json(POOL, {"jobs": []})["jobs"]}
    matches = sorted(read_json(c.matches_file, {"matches": []})["matches"], key=lambda m: -m["score"])
    fresh = [m for m in matches if m["jobId"] not in known and m["jobId"] in pool][:room]
    stamp = time.time()
    for i, m in enumerate(fresh):
        job = pool[m["jobId"]]
        at = datetime.fromtimestamp(stamp + i / 1000, timezone.utc).isoformat()
        apps.append({
            "id": f"app_{job['id']}",
            "jobId": job["id"],
            "company": job["company"],
            "companyLogo": job.get("companyLogo"),
            "role": job["title"],
            "location": job["location"],
            "ats": job["ats"],
            "matchScore": m["score"],
            "sponsorship": "unknown",
            "status": "queued",
            "queuedAt": at,
            "updatedAt": at,
            "postingUrl": job["url"],
            "autoQueued": True,
        })


def claim_next(apps: list[dict]) -> dict | None:
    """Marks the oldest queued job as applying, under the lock, and returns a copy."""
    queued = [a for a in apps if a["status"] == "queued"]
    if not queued:
        return None
    job = min(queued, key=lambda a: a["queuedAt"])
    job.update(status="applying", updatedAt=now(), progress={"step": STEPS[0], "current": 1, "total": len(STEPS)})
    job.pop("control", None)
    return dict(job)


def find(apps: list[dict], job_id: str) -> dict | None:
    return next((a for a in apps if a["jobId"] == job_id), None)


def update(c: Candidate, job_id: str, **fields) -> None:
    def change(apps: list[dict]) -> None:
        a = find(apps, job_id)
        if a:
            a.update(fields, updatedAt=now())
    c.mutate(change)


def finish(c: Candidate, job_id: str, status: str, reason: str) -> None:
    def change(apps: list[dict]) -> None:
        a = find(apps, job_id)
        if not a:
            return
        a.update(status=status, updatedAt=now(), reason=reason or None,
                 resolution=None if status == "applied" else ("retry" if status == "failed" else "dismiss"))
        for key in ("progress", "liveUrl", "control"):
            a.pop(key, None)
    c.mutate(change)


def stopped(c: Candidate, job_id: str, request: str) -> None:
    """Pause parks the job (it keeps its place); cancel removes it so the job can be applied to again."""
    def change(apps: list[dict]) -> None:
        a = find(apps, job_id)
        if not a:
            return
        if request == "cancel":
            apps.remove(a)
            return
        a.update(status="paused", updatedAt=now())
        for key in ("progress", "liveUrl", "control", "reason"):
            a.pop(key, None)
    c.mutate(change)


def run(c: Candidate) -> None:
    if another_worker_running(c):
        print(f"[Worker] An engine for {c.id} is already running. Exiting.")
        return
    set_status(c, state="starting", message="Starting", jobId=None, startedAt=now())
    threading.Thread(target=heartbeat, args=(c,), daemon=True).start()

    # Imported late: Playwright is slow to load, and the app waits for the first heartbeat.
    from engine.apply import Cancelled, apply_to_job

    # A job left "applying" by a crash goes back to the queue.
    def recover(apps: list[dict]) -> None:
        for a in apps:
            if a["status"] == "applying":
                a.update(status="queued", updatedAt=now())
                for key in ("progress", "liveUrl", "control"):
                    a.pop(key, None)
    c.mutate(recover)

    while True:
        s = c.settings()
        if not s["enabled"]:
            set_status(c, state="off", message="Auto-Apply is off", jobId=None)
            print("[Worker] Auto-Apply turned off. Exiting.")
            return

        if s["autoApplyMatches"]:
            c.mutate(lambda apps: queue_matches(c, apps))

        if applied_today(c.load_applications()) >= DAILY_LIMIT:
            set_status(c, state="limit", message=f"Daily limit reached ({DAILY_LIMIT} applications). Resumes tomorrow.", jobId=None)
            time.sleep(30)
            continue

        job = c.mutate(claim_next)
        if not job:
            set_status(c, state="idle", message="Waiting for jobs in the queue", jobId=None)
            time.sleep(3)
            continue

        job_id = job["jobId"]
        profile = read_json(c.profile_file, None)
        resume = DATA / profile["resume_pdf"] if profile and profile.get("resume_pdf") else None
        if not profile or not resume or not resume.exists():
            finish(c, job_id, "failed", "No stored resume. Finish onboarding before Auto-Apply can send applications.")
            continue

        print(f"\n[Worker] Applying: {job['role']} at {job['company']} ({job['ats']})")
        request: dict = {}

        def stop() -> bool:
            a = find(c.load_applications(), job_id)
            control = "cancel" if a is None else a.get("control")
            if control:
                request["kind"] = control
            return bool(control)

        def report(step: str) -> None:
            current = next((i + 1 for i, s_ in enumerate(STEPS) if step.startswith(s_)), 2)
            update(c, job_id, progress={"step": step, "current": current, "total": len(STEPS)})
            set_status(c, state="applying", message=step, jobId=job_id)
            print(f"[Worker]   {step}")

        def on_live(url: str) -> None:
            update(c, job_id, liveUrl=url)

        set_status(c, state="applying", message=STEPS[0], jobId=job_id)
        try:
            # Read per job, so changing "Submit automatically" applies from the next application.
            status, reason = apply_to_job(job, profile, str(resume), c.id, bool(s["autoSubmit"]), report, stop, on_live)
        except Cancelled:
            kind = request.get("kind", "pause")
            stopped(c, job_id, kind)
            print(f"[Worker]   -> {'cancelled' if kind == 'cancel' else 'paused'} by the candidate")
            continue
        finish(c, job_id, status, reason)
        print(f"[Worker]   -> {status}{': ' + reason if reason else ''}")
        time.sleep(random.uniform(2, 4))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Apply to one candidate's queued jobs.")
    parser.add_argument("--candidate", default="candidate", help="candidate id (\"candidate\" until Clerk)")
    candidate = Candidate(parser.parse_args().candidate)
    try:
        run(candidate)
    except KeyboardInterrupt:
        set_status(candidate, state="off", message="Engine stopped", jobId=None)
        sys.exit(0)
