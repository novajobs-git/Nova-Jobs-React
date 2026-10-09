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


# Well-known tech employers (user decision, 2026-10-07), by the board each one
# actually hires through. Slugs are looked up in the directory, so the URL
# (needed for Workday) comes from there rather than being guessed.
CURATED: dict[str, list[str]] = {
    "greenhouse": [
        "airbnb", "stripe", "coinbase", "robinhood", "figma", "gitlab", "reddit", "asana", "cloudflare",
        "affirm", "instacart", "dropbox", "pinterest", "lyft", "databricks", "datadog", "discord", "roblox",
        "okta", "mongodb", "elastic", "hubspotjobs", "squarespace", "duolingo", "anthropic", "scaleai",
        "brex", "samsara", "toast", "twilio", "webflow", "block", "flexport", "klaviyo", "postman",
        "fivetran", "airtable", "calendly", "peloton", "nextdoor", "vercel", "mercury",
    ],
    "ashby": ["openai", "notion", "ramp", "linear", "plaid", "snowflake", "deel", "confluent", "quora"],
    "lever": ["spotify"],
    "workday": [
        "salesforce/external_career_site", "nvidia/nvidiaexternalcareersite", "intel/external",
        "cisco/cisco_careers", "workday/workday", "paypal/jobs", "visa/visa", "mastercard/corporatecareers",
        "walmart/walmartexternal", "target/targetcareers", "capitalone/capital_one", "zoom/zoom",
        "etsy/etsy_careers", "zillow/zillow_group_external", "expedia/search", "autodesk/ext",
        "dell/external", "hp/externalcareersite", "qualcomm/external", "micron/external",
    ],
    "smartrecruiters": ["servicenow", "bloomberg", "canva", "intuit2"],
}


# Display names that capitalising a lowercase directory name gets wrong.
DISPLAY_NAMES = {"mongodb": "MongoDB"}


def _display_name(name: str) -> str:
    if name.lower() in DISPLAY_NAMES:
        return DISPLAY_NAMES[name.lower()]
    return name if name != name.lower() else name.title()


def load_boards(ats: str, count: int, seed: int, slugs: list[str] | None = None, curated: bool = False) -> list[Board]:
    """Boards for one ATS: the curated company list, explicit `slugs`, or
    `count` boards sampled reproducibly by `seed` (a different seed per run
    rotates through the directory).
    """
    df = Client().companies()
    df = df[df["ats"] == ats]
    if curated and not slugs:
        slugs = CURATED.get(ats, [])
        if not slugs:
            return []
    if slugs:
        wanted = {s.lower() for s in slugs}
        df = df[df["slug"].str.lower().isin(wanted)].drop_duplicates("slug")
    elif count < len(df):
        df = df.sample(count, random_state=seed)
    return [
        Board(ats=ATS[ats], company=_display_name(str(row["name"])), slug=str(row["slug"]), url=str(row["url"]))
        for _, row in df.iterrows()
    ]
