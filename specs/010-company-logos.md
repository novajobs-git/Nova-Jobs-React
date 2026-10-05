# 010 — Company logos from the ATS boards

**Status:** Done (2026-10-05)

## Goal

Replace the monogram tiles on the Jobs page with each company's real logo,
taken from the same ATS board the scraper (spec 004) already visits. No
third-party logo service and no guessing a company's domain.

## Where each ATS exposes the logo (checked live on 2026-10-05)

| ATS | Source in the board's server HTML |
|---|---|
| Greenhouse | `og:image`, only when it is a board logo (`…/logos/…`); a board that redirects to the company site has no logo |
| Lever | `.main-header-logo img` `src` |
| Ashby | `window.__appData.organization.theme.logoSquareImageUrl` (the square mark, not the wordmark) |
| Workday | `og:image` (`{site}/assets/logo`) |
| SmartRecruiters | `og:image`, only when it is `sr-company-logo` (otherwise it is SmartRecruiters' own) |

## Scope

In:
- `scripts/ats/scrapers.py`: `board_logo()` fetches the board's HTML once per
  board and `logo_from_html()` extracts the URL per the table above. A logo
  failure never fails the board; the job just has no logo.
- `ScrapedJob.company_logo` → record field `companyLogo` (`string | null`).
- `scripts/enrich_logos.py`: backfills `companyLogo` for jobs already in
  `data/jobs/us-jobs.json`, one request per board. `null` records "looked,
  none found" so re-runs skip it; `--retry` retries those.
- Next.js: `companyLogo` is read from the pool into `Job.companyLogo`;
  `CompanyLogo` shows it on a white tile and falls back to the building placeholder when
  there is no logo or the image fails to load.

Out:
- Downloading/re-hosting logos (they are hot-linked from the ATS CDN). Revisit
  with Supabase Storage in spec 008.
- Logos for demo data and for the Applications page.

## Acceptance criteria

- [x] Each ATS's extractor returns the real logo for a live board (Greenhouse
      `gitlab`/`discord`, Lever `palantir`, Ashby `ramp`, Workday `nvidia`,
      SmartRecruiters `Visa`), checked against the board HTML.
- [x] New scrapes write `companyLogo`; the backfill fills existing jobs.
- [x] Jobs without a logo, or whose logo fails to load, show the building placeholder (`public/company-placeholder.png`).
