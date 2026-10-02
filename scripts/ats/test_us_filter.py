"""Run: .venv\\Scripts\\python -m scripts.ats.test_us_filter"""

from scripts.ats.us_filter import is_us_location

US = [
    "New York, NY",
    "San Francisco, CA",
    "Remote - United States",
    "Remote (US)",
    "Austin, Texas",
    "Washington, DC",
    "USA",
    "London, UK; New York, NY",
    "Remote, US/Canada",
    "San Francisco Bay Area",
    "Palo Alto (HQ)",
    "San Francisco Bay Area or Los Angeles Area",
]
NOT_US = [
    "Remote",
    "London, UK",
    "Toronto, ON",
    "Toronto, Ontario, Canada",
    "Bengaluru, India",
    "Tbilisi, Georgia, Europe",
    "Remote - EMEA",
    "Mexico City",
    "Latin America",
    "Cambridge, England",
    "Vancouver, BC",
    "Remote, North America",
    "",
]


def main() -> None:
    failures = [loc for loc in US if not is_us_location(loc)]
    failures += [loc for loc in NOT_US if is_us_location(loc)]
    failures += [] if is_us_location("Remote", country="US") else ["country=US"]
    failures += [] if not is_us_location("Berlin", country="DE") else ["country=DE"]
    if failures:
        raise SystemExit(f"FAILED: {failures}")
    print(f"us_filter OK ({len(US) + len(NOT_US) + 2} cases)")


if __name__ == "__main__":
    main()
