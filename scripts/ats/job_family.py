"""Which tech job family a title belongs to, or None (spec 015).

The pool keeps only Software Engineering, AI/ML, Data & Analytics,
Product/Project management and adjacent tech roles (user decision,
2026-10-06). Classified on the title alone, so it works at scrape time
before descriptions are fetched.
"""

from __future__ import annotations

import re

# Checked first: titles that mention a tech word but aren't tech jobs.
_NOT_TECH = re.compile(
    r"\b(recruit\w*|talent acquisition|sales|account (executive|manager)|business development|"
    r"customer success|marketing|copywriter|legal|counsel|paralegal|accountant|payroll|"
    r"nurse|physician|clinical|pharmac\w*|driver|warehouse|technician|mechanic|electrician|"
    r"facilities|janitor|cashier|barista|chef|cook|retail|store manager|"
    # Engineering and project roles outside software:
    r"construction|manufacturing|civil|mechanical|electrical|high voltage|hvac|plumbing|structural|"
    r"mining|chemical|process engineer|control systems|metrology|aircraft|biocontainment|"
    # Gig and labelling work that mentions AI:
    r"contributor|annotat\w*|label+er|teleoperator|tutor|trainer)\b",
    re.I,
)

# Order matters: the first family that matches wins.
_FAMILIES: list[tuple[str, re.Pattern[str]]] = [
    ("ai_ml", re.compile(
        r"\b(machine learning|ml|ai|a\.i\.|artificial intelligence|deep learning|nlp|natural language|"
        r"computer vision|llm|generative|genai|mlops|applied scientist|research scientist|ai/ml|ml/ai)\b", re.I)),
    ("data", re.compile(
        r"\b(data (engineer|analyst|scientist|architect|platform)|analytics( engineer)?|business intelligence|"
        r"bi (developer|engineer|analyst)|data science|quantitative analyst|database (engineer|administrator|developer)|dba)\b", re.I)),
    ("product_project", re.compile(
        r"\b(project manager|program manager|product manager|technical program|tpm|scrum master|"
        r"product owner|delivery manager|agile coach|release manager|pmo)\b", re.I)),
    ("devops_cloud", re.compile(
        r"\b(devops|dev ops|site reliability|sre|cloud (engineer|architect)|platform engineer|"
        r"infrastructure engineer|kubernetes|network engineer|devsecops)\b", re.I)),
    ("security", re.compile(
        r"\b(security engineer|cyber ?security|application security|appsec|information security|infosec|"
        r"security analyst|penetration tester|soc analyst)\b", re.I)),
    ("qa", re.compile(r"\b(qa|quality assurance|test engineer|sdet|automation engineer|software tester)\b", re.I)),
    ("software", re.compile(
        r"\b(software|developer|programmer|engineer(ing)? manager|back[- ]?end|front[- ]?end|full[- ]?stack|"
        r"web (engineer|developer)|mobile (engineer|developer)|ios|android|sde|swe|"
        r"(solutions|software|technical) architect|firmware|embedded|game (developer|engineer)|"
        r"(python|java|javascript|typescript|golang|go|rust|c\+\+|\.net|ruby|php|react|node) (engineer|developer))\b", re.I)),
]


def job_family(title: str) -> str | None:
    """The tech family for a job title, or None if it isn't a tech role."""
    if _NOT_TECH.search(title):
        return None
    for family, pattern in _FAMILIES:
        if pattern.search(title):
            return family
    return None
