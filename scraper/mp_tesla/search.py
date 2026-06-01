"""Call Marktplaats' internal search API and yield Model 3 / Model Y listings.

The endpoint returns structured JSON. We pass the Tesla brand attribute plus the
Model 3 and Model Y attribute IDs, so results are pre-filtered to the two models
we care about (a title guard catches any stragglers).
"""
from __future__ import annotations

import logging
import random
import time
from typing import Iterator

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from . import config

log = logging.getLogger(__name__)


def _client() -> httpx.Client:
    return httpx.Client(
        headers={
            "User-Agent": config.USER_AGENT,
            "Accept": "application/json",
            "Accept-Language": "nl-NL,nl;q=0.9,en;q=0.8",
            "Referer": f"{config.BASE_URL}/l/auto-s/tesla/",
        },
        timeout=config.REQUEST_TIMEOUT,
        follow_redirects=True,
    )


def _build_params(offset: int, limit: int) -> list[tuple[str, str]]:
    """Query params mirroring the site's own XHR (order-independent, repeated keys)."""
    params: list[tuple[str, str]] = [
        ("l1CategoryId", str(config.L1_CATEGORY_ID)),
        ("l2CategoryId", str(config.L2_CATEGORY_ID)),
        ("attributesById[]", str(config.TESLA_BRAND_ATTR_ID)),
        ("attributesById[]", str(config.MODEL_ATTR_IDS["Model 3"])),
        ("attributesById[]", str(config.MODEL_ATTR_IDS["Model Y"])),
        ("attributeRanges[]", f"constructionYear:{config.CONSTRUCTION_YEAR_FROM}:null"),
        ("attributeRanges[]", f"PriceCents:null:{config.PRICE_CENTS_TO}"),
        ("postcode", config.POSTCODE),  # makes location.distanceMeters relative to 3051
        ("limit", str(limit)),
        ("offset", str(offset)),
        ("sortBy", config.SORT_BY),
        ("viewOptions", "list-view"),
    ]
    return params


@retry(
    retry=retry_if_exception_type((httpx.HTTPStatusError, httpx.TransportError)),
    wait=wait_exponential(multiplier=1.5, min=2, max=30),
    stop=stop_after_attempt(config.MAX_RETRIES),
    reraise=True,
)
def _fetch_page(client: httpx.Client, offset: int, limit: int) -> dict:
    resp = client.get(config.SEARCH_URL, params=_build_params(offset, limit))
    resp.raise_for_status()
    return resp.json()


def _is_model_3_or_y(listing: dict) -> str | None:
    """Return canonical 'Model 3' / 'Model Y' or None, from attributes or title."""
    for attr in listing.get("attributes", []):
        if attr.get("key") == "model":
            val = attr.get("value", "")
            if "Model 3" in val:
                return "Model 3"
            if "Model Y" in val:
                return "Model Y"
    title = listing.get("title", "")
    if "Model 3" in title:
        return "Model 3"
    if "Model Y" in title:
        return "Model Y"
    return None


def iter_search_listings(max_pages: int | None = None) -> Iterator[dict]:
    """Yield raw listing dicts (Model 3/Y only), paginating until exhausted."""
    max_pages = max_pages or config.MAX_PAGES
    seen_total: int | None = None
    with _client() as client:
        for page in range(max_pages):
            offset = page * config.PAGE_SIZE
            if seen_total is not None and offset >= seen_total:
                break
            data = _fetch_page(client, offset, config.PAGE_SIZE)
            seen_total = data.get("totalResultCount", 0)
            listings = data.get("listings", [])
            if not listings:
                break
            log.info("search page %d: %d listings (total=%s)", page, len(listings), seen_total)
            for raw in listings:
                model = _is_model_3_or_y(raw)
                if model:
                    raw["_canonical_model"] = model
                    yield raw
            time.sleep(random.uniform(*config.SEARCH_DELAY_RANGE))
