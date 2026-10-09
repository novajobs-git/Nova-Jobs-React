"""Extract each job's seniority, minimum years, degree and salary once (spec 014).

Rules first (scripts/ats/requirements.py); Gemini only for jobs where the
title and description gave neither a level nor years. Results are stored on
the job in data/jobs/us-jobs.json with `requirementsVersion`, so a job is
never processed twice unless the rules version changes. Resumable: progress
is saved as it goes.

Run from the repo root:
    .venv\\Scripts\\python -m scripts.extract_requirements [--limit 200] [--no-llm]
"""

from __future__ import annotations

import argparse
import json
import os
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from engine.gemini import generate_json
from scripts.ats.requirements import DEGREES, REQUIREMENTS_VERSION, TIERS, extract_rules, normalize_title

POOL = Path(__file__).resolve().parent.parent / "data" / "jobs" / "us-jobs.json"
LLM_CHARS = 6000
LLM_WORKERS = 4
SAVE_EVERY = 50

LLM_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "seniority_level": {"type": "STRING", "enum": TIERS, "nullable": True},
        "min_years_experience": {"type": "INTEGER", "nullable": True},
        "degree_required": {"type": "STRING", "enum": DEGREES},
        "degree_preferred": {"type": "STRING", "enum": DEGREES, "nullable": True},
    },
    "required": ["seniority_level", "min_years_experience", "degree_required", "degree_preferred"],
}

PROMPT = """Read this job posting and return its requirements as JSON.
- seniority_level: one of new_grad (interns, new graduates), entry (junior), mid, senior, staff (staff/principal), vp (director and above). null if the posting gives no indication.
- min_years_experience: the minimum years of professional experience REQUIRED (not preferred). null if not stated.
- degree_required: the lowest degree the posting REQUIRES (none, bachelor, master, phd). "none" if no degree is required or "equivalent experience" is accepted.
- degree_preferred: a higher degree it prefers, or null.

Job title: {title}
Job description:
{description}"""


def save(data: dict) -> None:
    tmp = POOL.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(data, indent=1, ensure_ascii=False), encoding="utf-8")
    os.replace(tmp, POOL)


def ask_llm(job: dict) -> dict | None:
    try:
        return generate_json(PROMPT.format(title=job["title"], description=(job.get("description") or "")[:LLM_CHARS]), LLM_SCHEMA)
    except Exception as e:  # one bad reply never stops the run; the job falls back to the default level
        print(f"  [Gemini] {job['company']} - {job['title']}: {e}")
        return None


def apply_llm(job: dict, rules: dict, answer: dict | None) -> None:
    tier = answer and answer.get("seniority_level")
    years = answer and answer.get("min_years_experience")
    if tier in TIERS:
        job["seniorityLevel"], job["requirementsSource"] = tier, "llm"
    if isinstance(years, int) and 0 <= years <= 20:
        job["minYearsExperience"], job["requirementsSource"] = years, "llm"
    # The rules' degree wins whenever the description mentioned one at all.
    if answer and rules["degreeRequired"] == "none" and rules["degreePreferred"] is None:
        if answer.get("degree_required") in DEGREES:
            job["degreeRequired"] = answer["degree_required"]
        if answer.get("degree_preferred") in DEGREES and answer["degree_preferred"] != job["degreeRequired"]:
            job["degreePreferred"] = answer["degree_preferred"]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--limit", type=int, help="process at most N jobs")
    parser.add_argument("--no-llm", action="store_true", help="rules only; unresolved jobs get the default level and are retried next run")
    args = parser.parse_args()

    data = json.loads(POOL.read_text(encoding="utf-8"))
    todo = [j for j in data["jobs"] if j.get("requirementsVersion") != REQUIREMENTS_VERSION]
    if args.limit:
        todo = todo[: args.limit]
    print(f"{len(todo)} of {len(data['jobs'])} jobs need requirements")

    sources: dict[str, int] = {}
    llm_jobs: list[tuple[dict, dict]] = []
    for job in todo:
        rules = extract_rules(job["title"], job.get("description"))
        job.update({k: v for k, v in rules.items() if k != "needsLlm"})
        job["titleNormalized"] = normalize_title(job["title"])
        if rules["needsLlm"] and not args.no_llm:
            llm_jobs.append((job, rules))
            continue
        if rules["needsLlm"]:
            job["seniorityLevel"], job["requirementsSource"] = "mid", "default"
            continue  # left without a version so the LLM pass picks it up later
        job["requirementsVersion"] = REQUIREMENTS_VERSION
        sources[job["requirementsSource"]] = sources.get(job["requirementsSource"], 0) + 1
    save(data)

    print(f"rules resolved {len(todo) - len(llm_jobs)}; asking Gemini about {len(llm_jobs)}")
    with ThreadPoolExecutor(LLM_WORKERS) as pool:
        for n, ((job, rules), answer) in enumerate(zip(llm_jobs, pool.map(lambda jr: ask_llm(jr[0]), llm_jobs)), 1):
            apply_llm(job, rules, answer)
            if not job.get("seniorityLevel"):
                job["seniorityLevel"], job["requirementsSource"] = "mid", "default"
            if answer is not None:
                job["requirementsVersion"] = REQUIREMENTS_VERSION  # a failed call is retried next run
            sources[job["requirementsSource"]] = sources.get(job["requirementsSource"], 0) + 1
            if n % SAVE_EVERY == 0:
                save(data)
                print(f"  {n}/{len(llm_jobs)}")
    save(data)

    tiers: dict[str, int] = {}
    for j in data["jobs"]:
        tiers[j.get("seniorityLevel") or "?"] = tiers.get(j.get("seniorityLevel") or "?", 0) + 1
    print("sources this run:", sources)
    print("pool by level:", {t: tiers.get(t, 0) for t in [*TIERS, "?"] if tiers.get(t)})


if __name__ == "__main__":
    main()
