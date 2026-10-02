"""Which boards to visit: the `ats-scrapers` public company directory.

The directory (~80k companies across many ATSs, columns ats/name/slug/url)
replaces a hand-maintained company list. It only tells us which boards
exist; jobs themselves are read live by our Playwright scrapers.
"""

from __future__ import annotations

from ats_scrapers import Client

from scripts.ats.models import Board

# CLI key -> (ats-scrapers ATSType value, display name used across the app)
ATS = {
    "greenhouse": "Greenhouse",
    "lever": "Lever",
    "ashby": "Ashby",
    "workday": "Workday",
    "smartrecruiters": "SmartRecruiters",
}


def load_boards(ats: str, count: int, seed: int, slugs: list[str] | None = None) -> list[Board]:
    """`count` boards for one ATS, sampled reproducibly by `seed`.

    A different seed per run (the CLI defaults to today's date) rotates
    through the directory instead of re-scraping the same companies.
    """
    df = Client().companies()
    df = df[df["ats"] == ats]
    if slugs:
        wanted = {s.lower() for s in slugs}
        df = df[df["slug"].str.lower().isin(wanted)]
    elif count < len(df):
        df = df.sample(count, random_state=seed)
    return [
        Board(ats=ATS[ats], company=str(row["name"]), slug=str(row["slug"]), url=str(row["url"]))
        for _, row in df.iterrows()
    ]
