"""Playwright fallback for detail pages that a plain request can't retrieve.

Only used when detail.fetch_html / parse_detail reports a block (missing
__CONFIG__). Kept isolated so the common, fast httpx path has no browser
dependency. Import of playwright is lazy so the package works without it
installed when the fallback is never triggered.
"""
from __future__ import annotations

import logging

from . import config

log = logging.getLogger(__name__)


def fetch_html_with_browser(vip_url: str) -> str:
    """Render the VIP page in headless Chromium and return its HTML."""
    try:
        from playwright.sync_api import sync_playwright
    except ImportError as exc:  # pragma: no cover - depends on optional extra
        raise RuntimeError(
            "Playwright fallback requested but not installed. "
            "Run `pip install playwright && playwright install chromium`."
        ) from exc

    url = vip_url if vip_url.startswith("http") else config.BASE_URL + vip_url
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(user_agent=config.USER_AGENT, locale="nl-NL")
        try:
            page.goto(url, wait_until="domcontentloaded", timeout=int(config.REQUEST_TIMEOUT * 1000))
            page.wait_for_selector('[class^="Description"]', timeout=10_000)
            return page.content()
        finally:
            browser.close()
