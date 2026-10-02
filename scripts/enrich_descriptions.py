"""Add job descriptions to the pool so jobs can be keyword-matched (spec 006).

For every job in data/jobs/us-jobs.json without a `description`, fetch its
posting page through the Playwright browser context and extract the text:
  1. schema.org JobPosting JSON-LD (Lever, Ashby, Workday)
  2. the ATS's description element (Greenhouse `.job__description`,
     SmartRecruiters `itemprop="description"`)
Resumable: jobs that already have a description (or a recorded failure) are
skipped, and progress is saved as it goes.

Run from the repo root:
    .venv\\Scripts\\python -m scripts.enrich_descriptions [--limit 200] [--concurrency 8]
"""

from __future__ import annotations

import argparse
import asyncio
import html
import json
import re
from html.parser import HTMLParser
from pathlib import Path

from scripts.ats.browser import browser_context

POOL = Path(__file__).resolve().parent.parent / "data" / "jobs" / "us-jobs.json"
MAX_CHARS = 8000
SAVE_EVERY = 100

LD_JSON = re.compile(r"<script[^>]*application/ld\+json[^>]*>(.*?)</script>", re.S | re.I)
DESCRIPTION_ELEMENTS = [
    ("class", "job__description"),  # Greenhouse
    ("itemprop", "description"),  # SmartRecruiters
    ("class", "job-sections"),
]


def html_to_text(fragment: str) -> str:
    text = re.sub(r"<(br|/p|/li|/h\d|/div)[^>]*>", "\n", fragment, flags=re.I)
    text = re.sub(r"<[^>]+>", " ", text)
    text = html.unescape(text)
    text = re.sub(r"[ \t\xa0]+", " ", text)
    return re.sub(r"\n\s*\n+", "\n", text).strip()


def from_json_ld(page: str) -> str | None:
    for block in LD_JSON.findall(page):
        try:
            data = json.loads(block.strip())
        except json.JSONDecodeError:
            continue
        for item in data if isinstance(data, list) else [data]:
            if isinstance(item, dict) and item.get("description"):
                return html_to_text(str(item["description"]))
    return None


# Elements with no closing tag: counting them would leave the depth > 0 forever
# and the extractor would swallow the rest of the page (scripts, CSS...).
VOID_TAGS = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"}
BREAK_TAGS = {"p", "li", "br", "div", "h1", "h2", "h3", "h4", "h5", "h6", "tr"}


class _ElementText(HTMLParser):
    """Text inside the first element whose attribute `name` contains `value`."""

    def __init__(self, name: str, value: str) -> None:
        super().__init__(convert_charrefs=True)
        self.name, self.value = name, value
        self.depth = 0
        self.skip = 0  # inside <script>/<style>
        self.parts: list[str] = []
        self.done = False

    def handle_starttag(self, tag, attrs):
        if self.done:
            return
        if self.depth:
            if tag in BREAK_TAGS:
                self.parts.append("\n")
            if tag in {"script", "style"}:
                self.skip += 1
            if tag not in VOID_TAGS:
                self.depth += 1
        elif tag not in VOID_TAGS and any(k == self.name and v and self.value in v.split() for k, v in attrs):
            self.depth = 1

    def handle_endtag(self, tag):
        if self.done or not self.depth or tag in VOID_TAGS:
            return
        if tag in {"script", "style"} and self.skip:
            self.skip -= 1
        self.depth -= 1
        if self.depth == 0:
            self.done = True

    def handle_data(self, data):
        if self.depth and not self.skip and not self.done:
            self.parts.append(data)


def from_element(page: str) -> str | None:
    for name, value in DESCRIPTION_ELEMENTS:
        parser = _ElementText(name, value)
        parser.feed(page)
        text = re.sub(r"\n\s*\n+", "\n", re.sub(r"[ \t\xa0]+", " ", "".join(parser.parts))).strip()
        if len(text) > 80:
            return text
    return None


async def describe(context, job: dict, gate: asyncio.Semaphore) -> str:
    async with gate:
        try:
            response = await context.request.get(job["url"], timeout=30_000)
            if not response.ok:
                return ""
            page = await response.text()
        except Exception:
            return ""
    text = from_json_ld(page) or from_element(page) or ""
    return text[:MAX_CHARS]


async def run(limit: int | None, concurrency: int, headed: bool) -> None:
    pool = json.loads(POOL.read_text(encoding="utf-8"))
    todo = [j for j in pool["jobs"] if "description" not in j]
    if limit:
        todo = todo[:limit]
    print(f"{len(todo)} jobs need a description ({len(pool['jobs'])} in pool)")

    gate = asyncio.Semaphore(concurrency)
    found = 0
    async with browser_context(headed=headed) as context:
        for start in range(0, len(todo), SAVE_EVERY):
            batch = todo[start : start + SAVE_EVERY]
            texts = await asyncio.gather(*(describe(context, j, gate) for j in batch))
            for job, text in zip(batch, texts):
                job["description"] = text  # "" records a failed fetch so it isn't retried forever
                found += bool(text)
            POOL.write_text(json.dumps(pool, indent=1, ensure_ascii=False), encoding="utf-8")
            print(f"  {start + len(batch)}/{len(todo)} done, {found} with descriptions")

    by_ats: dict[str, list[int]] = {}
    for job in pool["jobs"]:
        if "description" in job:
            stats = by_ats.setdefault(job["ats"], [0, 0])
            stats[0] += 1
            stats[1] += bool(job["description"])
    for ats, (total, ok) in sorted(by_ats.items()):
        print(f"  {ats:16} {ok}/{total} with descriptions")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--limit", type=int, help="only process this many jobs")
    parser.add_argument("--concurrency", type=int, default=8)
    parser.add_argument("--headed", action="store_true")
    args = parser.parse_args()
    asyncio.run(run(args.limit, args.concurrency, args.headed))


if __name__ == "__main__":
    main()
