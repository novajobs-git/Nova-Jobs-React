"""Job requirement extraction rules (spec 014): seniority tier, minimum years,
degree required/preferred and salary range, cheapest pass first.

  a. title keywords   -> seniority
  b. description regex -> years, degree, salary (and seniority from years
     when the title had no signal)
  c. Gemini, only when both seniority and years are still unknown
     (scripts/extract_requirements.py)

normalize_title() is mirrored by lib/matching/titles.ts; keep them in step.
"""

from __future__ import annotations

import re

REQUIREMENTS_VERSION = 1

TIERS = ["new_grad", "entry", "mid", "senior", "staff", "vp"]
DEGREES = ["none", "bachelor", "master", "phd"]

# --------------------------------------------------------------------------
# a. Title -> tier. Every rule that matches votes; the highest tier wins
#    ("Senior Staff" -> staff, "Associate Director" -> vp).
# --------------------------------------------------------------------------
_TITLE_RULES: list[tuple[str, re.Pattern]] = [
    ("vp", re.compile(r"\b(director|head of|vp|svp|evp|vice president|chief|cto|cio|ciso)\b", re.I)),
    # "Member of Technical Staff" is a flat title (OpenAI, Anthropic...), not the Staff level.
    ("staff", re.compile(r"(?<!technical )\b(staff|principal|distinguished|fellow|senior manager|sr\.? manager|group product manager)\b", re.I)),
    ("staff", re.compile(r"\b(engineer|developer|scientist)\s*,?\s*(iv|v|4|5)\b", re.I)),
    ("senior", re.compile(r"\b(senior|sr\.?|lead|tech lead)\b", re.I)),
    ("senior", re.compile(r"\b(engineering|software|machine learning|ml|data science|security|analytics) manager\b|\bmanager,? (of )?(software )?engineering\b", re.I)),
    ("senior", re.compile(r"\b(engineer|developer|scientist|analyst)\s*,?\s*(iii|3)\b", re.I)),
    ("mid", re.compile(r"\b(mid[- ]level|intermediate)\b", re.I)),
    ("mid", re.compile(r"\b(engineer|developer|scientist|analyst)\s*,?\s*(ii|2)\b", re.I)),
    ("entry", re.compile(r"\b(junior|jr\.?|entry[- ]level|entry)\b", re.I)),
    ("entry", re.compile(r"\bassociate\b(?!\s+(director|vice president|vp|general counsel|partner))", re.I)),
    ("entry", re.compile(r"\b(engineer|developer|scientist|analyst)\s*,?\s*(i|1)\b(?![./])", re.I)),
    ("new_grad", re.compile(r"\b(intern(ship)?|co-?op|apprentice(ship)?|new grad(uate)?|university grad(uate)?|graduate|early career|campus)\b", re.I)),
]


def title_tier(title: str) -> str | None:
    votes = [tier for tier, rx in _TITLE_RULES if rx.search(title)]
    if not votes:
        return None
    # An intern title is an intern role, whatever else it says ("Senior Intern" doesn't exist in practice).
    if "new_grad" in votes and re.search(r"\bintern(ship)?\b|\bco-?op\b", title, re.I):
        return "new_grad"
    return max(votes, key=TIERS.index)


def tier_from_years(years: int) -> str:
    if years <= 0:
        return "new_grad"
    if years == 1:
        return "entry"
    if years <= 4:
        return "mid"
    if years <= 7:
        return "senior"
    return "staff"


# --------------------------------------------------------------------------
# Title normalization for embeddings: drop level words, numerals, brackets,
# location words and scraped "New" badges so similarity measures the role
# only (the level is judged by the seniority filter).
# --------------------------------------------------------------------------
_LEVEL_WORDS = re.compile(
    r"(?<!technical )\b(senior|sr|staff|principal|lead|director|head of|vp|vice president|distinguished|fellow|junior|jr|"
    r"associate|intern(ship)?|co-?op|entry[- ]level|entry|new grad(uate)?|graduate|early career|mid[- ]level|intermediate)\b\.?\+?",
    re.I,
)


def normalize_title(title: str) -> str:
    t = re.sub(r"(?<=[a-z])New$", "", title.strip())  # "Software EngineerNew" (board badge glued on)
    t = t.lower()
    t = re.sub(r"\([^)]*\)|\[[^\]]*\]", " ", t)
    t = _LEVEL_WORDS.sub(" ", t)
    t = re.sub(r"\b(i{1,3}|iv|v|[1-5])\b", " ", t)
    t = re.sub(r"\b(remote|hybrid|onsite|on-site|us|usa|united states)\b", " ", t)
    t = re.sub(r"[^a-z0-9+#/&,. -]", " ", t)
    t = re.sub(r"\s+([,/])", r"\1", re.sub(r"\s+", " ", t))
    return t.strip(" ,-/.&+")


# --------------------------------------------------------------------------
# b. Description scan. Lines under a "preferred / nice to have" heading, or
#    sentences that say so, count as preferred, never required.
# --------------------------------------------------------------------------
_PREFERRED_HEADING = re.compile(r"\b(preferred|nice[- ]to[- ]have|bonus|pluses|desired|ideally|extra credit)\b", re.I)
_REQUIRED_HEADING = re.compile(
    r"\b(required|requirements|minimum|basic qualifications|qualifications|what you('ll)? (need|bring)|you have|about you|who you are|must have)\b",
    re.I,
)
_PREFERRED_INLINE = re.compile(r"\b(preferred|nice[- ]to[- ]have|is a plus|a plus|bonus|ideally|desired|preferably|optional)\b", re.I)

_WORD_NUMBERS = {
    "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7,
    "eight": 8, "nine": 9, "ten": 10, "eleven": 11, "twelve": 12, "fifteen": 15,
}
_NUM = r"(\d{1,2}|" + "|".join(_WORD_NUMBERS) + r")"
_YEARS = re.compile(
    rf"(?<![\d.,$])\b{_NUM}\s*(?:\+|plus)?\s*(?:(?:-|–|—|to)\s*{_NUM}\s*\+?\s*)?(?:or more\s+)?years?\b",
    re.I,
)
_EXPERIENCE_CONTEXT = re.compile(r"experience|exp\.|working|building|developing|industry|professional|hands-on|track record|in (a|an|the)?\s*\w+", re.I)
_NOT_EXPERIENCE = re.compile(r"\b(founded|history|since|ago|old|age|anniversary|warranty|retention|vesting|years? of (age|service)|company)\b", re.I)


def _lines(description: str, sentences: bool = True) -> list[tuple[str, bool]]:
    """(sentence or line, preferred?) pairs, tracking qualification headings."""
    out: list[tuple[str, bool]] = []
    preferred = False
    for raw in description.splitlines():
        line = raw.strip(" \t•·-*")
        if not line:
            continue
        # A heading, not a bullet: short, no digits, no closing period ("Preferred qualifications:").
        if len(line) < 70 and len(line.split()) <= 6 and not re.search(r"\d|\.$", line):
            if _PREFERRED_HEADING.search(line):
                preferred = True
                continue
            if _REQUIRED_HEADING.search(line):
                preferred = False
                continue
        for sentence in re.split(r"(?<=[.;!?])\s+", line) if sentences else [line]:
            out.append((sentence, preferred or bool(_PREFERRED_INLINE.search(sentence))))
    return out


def _num(s: str) -> int:
    return int(s) if s.isdigit() else _WORD_NUMBERS[s.lower()]


def min_years(description: str) -> tuple[int | None, int | None]:
    """(required, preferred) minimum years. Per sentence the lowest number wins
    ("BS with 5 years or MS with 3"); across sentences the highest required one
    does ("5+ years of engineering ... 2+ years with React")."""
    required: list[int] = []
    preferred: list[int] = []
    for sentence, is_preferred in _lines(description):
        if _NOT_EXPERIENCE.search(sentence):
            continue
        found = []
        for m in _YEARS.finditer(sentence):
            after = sentence[m.end() : m.end() + 60]
            if not _EXPERIENCE_CONTEXT.search(after) and "experience" not in sentence.lower():
                continue
            n = _num(m.group(1))
            if 0 <= n <= 20:
                found.append(n)
        if found:
            (preferred if is_preferred else required).append(min(found))
    return (max(required) if required else None, max(preferred) if preferred else None)


_DEGREE_PATTERNS = [
    ("phd", re.compile(r"\bph\.?\s?d\b|\bdoctora(te|l)\b", re.I)),
    ("master", re.compile(r"\bmaster(?:'s|’s|s)\b|\bmaster (?:of|degree)\b|\bm\.?s\.?(?=\s*(?:/|or\b|in\b|degree|,))(?!\s*(office|sql|excel|teams))|\bmba\b|\bm\.?eng\b|\bm\.tech\b", re.I)),
    ("bachelor", re.compile(r"\bbachelor'?s?\b|\bb\.?s\.?(?=\s*(?:/|or\b|in\b|degree|,))|\bb\.?a\.?(?=\s*(?:/|or\b|in\b|degree))|\bbsc\b|\bundergraduate\b|\b(four|4)[- ]year (college )?degree\b|\bb\.tech\b", re.I)),
]
_GENERIC_DEGREE = re.compile(r"\bdegree in\b|\bdegree\b.{0,40}\b(computer science|engineering|mathematics|statistics|related)\b", re.I)
_EQUIVALENT = re.compile(r"\bor equivalent\b|\bequivalent (practical |work |professional |industry )?experience\b|\bor related experience\b", re.I)


def degrees(description: str) -> tuple[str, str | None]:
    """(required, preferred). Judged per bullet line, so "BS + 5 years, or MS
    + 3, or PhD" stays one requirement. Required is the lowest level any
    required line accepts ("BS/MS/PhD" -> bachelor; alternatives on separate
    bullets too), since a wrong requirement hides the job outright; preferred
    is the highest level mentioned anywhere, when above it. "... or equivalent
    experience" makes the line a preference, not a requirement."""
    required: list[str] = []
    mentioned: list[str] = []
    for sentence, is_preferred in _lines(description, sentences=False):
        levels = [lvl for lvl, rx in _DEGREE_PATTERNS if rx.search(sentence)]
        if not levels and _GENERIC_DEGREE.search(sentence):
            levels = ["bachelor"]
        if not levels:
            continue
        mentioned += levels
        if not is_preferred and not _EQUIVALENT.search(sentence):
            required.append(min(levels, key=DEGREES.index))
    req = min(required, key=DEGREES.index) if required else "none"
    top = max(mentioned, key=DEGREES.index) if mentioned else None
    pref = top if top and DEGREES.index(top) > DEGREES.index(req) else None
    return req, pref


_MONEY = r"\$\s?(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*([kK])?"
_SALARY_RANGE = re.compile(rf"{_MONEY}\s*(?:-|–|—|to)\s*{_MONEY}(\s*(?:/|per)\s*(?:hr|hour))?", re.I)


def _amount(digits: str, k: str | None) -> float:
    n = float(digits.replace(",", ""))
    return n * 1000 if k else n


def salary_range(description: str) -> tuple[int | None, int | None]:
    """USD per year across every range the posting lists (pay zones included).
    Hourly ranges are annualized at 2,080 hours; anything outside 30k-1M is ignored."""
    lows: list[float] = []
    highs: list[float] = []
    for m in _SALARY_RANGE.finditer(description):
        lo, hi = _amount(m.group(1), m.group(2)), _amount(m.group(3), m.group(4))
        if m.group(5) or hi < 500:
            lo, hi = lo * 2080, hi * 2080
        if 30_000 <= lo <= hi <= 1_000_000:
            lows.append(lo)
            highs.append(hi)
    return (int(min(lows)), int(max(highs))) if lows else (None, None)


def extract_rules(title: str, description: str | None) -> dict:
    """Passes a and b. `needsLlm` is True when both seniority and years are unknown."""
    tier = title_tier(title)
    text = description or ""
    req_years, pref_years = min_years(text)
    degree_req, degree_pref = degrees(text) if text else ("none", None)
    sal_min, sal_max = salary_range(text)
    source = "title" if tier else None
    if not tier and (req_years is not None or pref_years is not None):
        tier = tier_from_years(req_years if req_years is not None else pref_years)
        source = "regex"
    return {
        "seniorityLevel": tier,
        "minYearsExperience": req_years,
        "degreeRequired": degree_req,
        "degreePreferred": degree_pref,
        "salaryMin": sal_min,
        "salaryMax": sal_max,
        "requirementsSource": source or "regex",
        "needsLlm": tier is None and req_years is None,
    }
