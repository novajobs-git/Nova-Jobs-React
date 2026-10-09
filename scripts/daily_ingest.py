"""The daily job-pool refresh, in order (plain Playwright, never Hyperbrowser):

  1. scripts.scrape_jobs          curated boards -> data/jobs/us-jobs.json
  2. scripts.enrich_descriptions  descriptions the board APIs didn't return
  3. scripts.extract_requirements seniority / years / degree / salary, once per job (spec 014)
  4. scripts.embed_titles         title embeddings, once per normalized title (spec 014)

Each step is resumable and skips work already done, so a failed run can just
be started again. Stale-job marking and the OS scheduler entry are still to come
in the ingestion spec.

Run from the repo root:
    .venv\\Scripts\\python -m scripts.daily_ingest [--skip-scrape]
"""

from __future__ import annotations

import argparse
import subprocess
import sys

STEPS = [
    ["scripts.scrape_jobs"],
    ["scripts.enrich_descriptions"],
    ["scripts.extract_requirements"],
    ["scripts.embed_titles"],
]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--skip-scrape", action="store_true", help="only run the enrichment steps on the existing pool")
    args = parser.parse_args()

    for step in STEPS[1:] if args.skip_scrape else STEPS:
        print(f"\n=== {step[0]} ===", flush=True)
        if subprocess.run([sys.executable, "-m", *step]).returncode != 0:
            sys.exit(f"{step[0]} failed; fix it and run again (finished steps skip their done work).")


if __name__ == "__main__":
    main()
