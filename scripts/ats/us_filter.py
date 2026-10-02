"""US-only inclusion policy, enforced at ingestion (architecture invariant).

Ported from the old app's `ingest_job_pool._is_us_location`. Same rules: an
explicit country wins; otherwise a clear US signal in the free-text
location is required. A bare "Remote" is excluded because nothing says it
is US-specific rather than global.

Changes from the old version: major US metros named without a state count
("San Francisco Bay Area"); a location that only names non-US countries is
rejected even if it contains a US-looking token ("Georgia" the country,
"Paris, ON"), and multi-location postings are kept when any part is US.
"""

from __future__ import annotations

import re

US_STATE_ABBR = {
    "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL", "IN", "IA",
    "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
    "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT",
    "VA", "WA", "WV", "WI", "WY", "DC",
}
US_STATE_NAMES = {
    "alabama", "alaska", "arizona", "arkansas", "california", "colorado", "connecticut",
    "delaware", "florida", "georgia", "hawaii", "idaho", "illinois", "indiana", "iowa",
    "kansas", "kentucky", "louisiana", "maine", "maryland", "massachusetts", "michigan",
    "minnesota", "mississippi", "missouri", "montana", "nebraska", "nevada",
    "new hampshire", "new jersey", "new mexico", "new york", "north carolina",
    "north dakota", "ohio", "oklahoma", "oregon", "pennsylvania", "rhode island",
    "south carolina", "south dakota", "tennessee", "texas", "utah", "vermont",
    "virginia", "washington", "west virginia", "wisconsin", "wyoming",
}
# Countries that commonly appear in US companies' postings. Enough to reject
# "London, UK" or "Remote - Canada"; not meant to be exhaustive.
NON_US_COUNTRIES = {
    "canada", "united kingdom", "uk", "england", "scotland", "ireland", "germany", "france",
    "spain", "portugal", "netherlands", "belgium", "switzerland", "austria", "italy", "poland",
    "sweden", "norway", "denmark", "finland", "india", "china", "japan", "singapore",
    "australia", "new zealand", "brazil", "mexico", "argentina", "colombia", "chile",
    "israel", "uae", "united arab emirates", "philippines", "vietnam", "indonesia", "korea",
    "south korea", "taiwan", "hong kong", "romania", "czech republic", "czechia", "ukraine",
    "turkey", "egypt", "nigeria", "kenya", "south africa", "pakistan", "bangladesh",
    "emea", "apac", "latam", "europe",
}
# Major US metros that postings name without a state ("San Francisco Bay
# Area", "Palo Alto (HQ)"). Names shared with non-US cities (Cambridge,
# London, Vancouver, Birmingham, Richmond...) are deliberately left out.
US_METROS = {
    "san francisco", "bay area", "silicon valley", "palo alto", "mountain view", "menlo park",
    "sunnyvale", "san jose", "santa clara", "redwood city", "san mateo", "oakland", "berkeley",
    "los angeles", "san diego", "irvine", "seattle", "bellevue", "redmond", "new york city", "nyc",
    "brooklyn", "manhattan", "chicago", "boston", "austin", "dallas", "houston", "denver", "boulder",
    "atlanta", "miami", "philadelphia", "pittsburgh", "phoenix", "salt lake city", "minneapolis",
    "nashville", "raleigh", "durham", "detroit", "st. louis", "kansas city", "baltimore",
}
CANADIAN_PROVINCES = {"ON", "BC", "QC", "AB", "MB", "SK", "NS", "NB", "NL", "PE"}

# "America" alone is excluded on purpose: "Latin America" is not the US.
_US_TEXT = re.compile(r"united states|\bu\.?s\.?a?\b|\busa\b", re.IGNORECASE)
_STATE_ABBR = re.compile(r",\s*(" + "|".join(sorted(US_STATE_ABBR)) + r")\b")
_PROVINCE_ABBR = re.compile(r",\s*(" + "|".join(sorted(CANADIAN_PROVINCES)) + r")\b")
_PART_SPLIT = re.compile(r"\s*(?:;|\||\n| / | or |•)\s*")


def _part_is_us(part: str) -> bool | None:
    """True = US, False = clearly non-US, None = no signal either way."""
    text = part.strip()
    lowered = text.lower()
    if not lowered:
        return None
    if _US_TEXT.search(text) or re.search(r"washington,? d\.?c", lowered):
        return True
    names_non_us = any(re.search(rf"\b{re.escape(c)}\b", lowered) for c in NON_US_COUNTRIES)
    if names_non_us or _PROVINCE_ABBR.search(text):
        return False
    if _STATE_ABBR.search(text):
        return True
    if any(re.search(rf"\b{name}\b", lowered) for name in US_STATE_NAMES):
        return True
    if any(re.search(rf"\b{re.escape(metro)}\b", lowered) for metro in US_METROS):
        return True
    return None


def is_us_location(location: str | None, country: str | None = None) -> bool:
    """Whether a posting belongs in the US-only pool."""
    if country:
        c = country.strip().lower()
        if c in {"us", "usa", "united states", "united states of america"}:
            return True
        # A structured non-US country is authoritative, unless the free text
        # also lists a US location (multi-location postings).
        return any(_part_is_us(p) for p in _PART_SPLIT.split(location or ""))
    parts = _PART_SPLIT.split(location or "")
    return any(_part_is_us(p) is True for p in parts)
