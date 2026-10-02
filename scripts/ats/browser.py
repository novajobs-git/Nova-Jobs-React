"""Shared Playwright setup.

Plain local Chromium with no stealth, fingerprint spoofing or CAPTCHA
solving: the old app's "no automation-detection evasion" principle stands
until the Hyperbrowser question is decided (progress-tracker Open
Questions). Boards that block a normal browser are logged and skipped.
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import Any, AsyncIterator

from playwright.async_api import BrowserContext, Page, Response, async_playwright

NAV_TIMEOUT_MS = 30_000


@asynccontextmanager
async def browser_context(headed: bool = False) -> AsyncIterator[BrowserContext]:
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=not headed)
        context = await browser.new_context(locale="en-US", viewport={"width": 1366, "height": 900})
        # Board pages pull in fonts, images and analytics we never read.
        await context.route(
            "**/*",
            lambda route: route.abort()
            if route.request.resource_type in {"image", "media", "font"}
            else route.continue_(),
        )
        try:
            yield context
        finally:
            await browser.close()


async def capture_json(page: Page, url: str, matches: str) -> list[Any]:
    """Open `url` and collect every JSON response whose URL contains `matches`.

    Most ATS boards render from their own JSON endpoints, so reading the
    responses the page itself makes is far more stable than DOM selectors.
    """
    responses: list[Response] = []

    # Collect synchronously and read bodies after navigation: parsing inside
    # the event handler raced the return and silently dropped late bodies.
    def on_response(response: Response) -> None:
        if matches in response.url and response.ok:
            responses.append(response)

    page.on("response", on_response)
    try:
        await page.goto(url, wait_until="networkidle", timeout=NAV_TIMEOUT_MS)
    finally:
        page.remove_listener("response", on_response)

    payloads: list[Any] = []
    for response in responses:
        try:
            payloads.append(await response.json())
        except Exception:
            pass  # not JSON (e.g. an HTML page whose URL also matched)
    return payloads
