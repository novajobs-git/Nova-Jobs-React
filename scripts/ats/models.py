from __future__ import annotations

import hashlib
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone


@dataclass(frozen=True)
class Board:
    """One company's job board on one ATS."""

    ats: str  # display name, e.g. "Greenhouse"
    company: str
    slug: str
    url: str | None = None


@dataclass
class ScrapedJob:
    ats: str
    company: str
    board_slug: str
    title: str
    location: str
    url: str
    country: str | None = None
    posted_at: str | None = None
    company_logo: str | None = None
    scraped_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat(timespec="seconds"))

    @property
    def content_hash(self) -> str:
        # Same dedupe key as the old ingest_job_pool._content_hash.
        key = f"{self.company}|{self.title}|{self.location}|{self.url}".lower()
        return hashlib.sha256(key.encode("utf-8")).hexdigest()

    def to_record(self) -> dict:
        """camelCase record matching lib/jobs/types.ts on the Next.js side."""
        d = asdict(self)
        h = self.content_hash
        return {
            "id": f"job_{h[:16]}",
            "contentHash": h,
            "ats": d["ats"],
            "company": d["company"],
            "boardSlug": d["board_slug"],
            "title": d["title"],
            "location": d["location"],
            "url": d["url"],
            "postedAt": d["posted_at"],
            "companyLogo": d["company_logo"],
            "scrapedAt": d["scraped_at"],
        }
