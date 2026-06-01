"""Call Marktplaats' internal search API and yield listings for a given brand.

The endpoint returns structured JSON. Each `Brand` (config.BRANDS) supplies the
category + attributeValueIds so results are pre-filtered server-side to the models /
fuels / transmissions we care about. A post-fetch guard catches any stragglers and
stamps the canonical model + brand on each raw listing.
"""
from __future__ import annotations

import logging
import random
import time
from typing import Iterator

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from . import config
from .config import Brand

log = logging.getLogger(__name__)


def _client(brand: Brand) -> httpx.Client:
    return httpx.Client(
        headers={
            "User-Agent": config.USER_AGENT,
            "Accept": "application/json",
            "Accept-Language": "nl-NL,nl;q=0.9,en;q=0.8",
            "Referer": f"{config.BASE_URL}/l/auto-s/{brand.key}/",
        },
        timeout=config.REQUEST_TIMEOUT,
        follow_redirects=True,
    )


def _build_params(brand: Brand, offset: int, limit: int) -> list[tuple[str, str]]:
    """Query params mirroring the site's own XHR (order-independent, repeated keys)."""
    params: list[tuple[str, str]] = [
        ("l1CategoryId", str(config.L1_CATEGORY_ID)),
        ("l2CategoryId", str(brand.l2_category_id)),
    ]
    for attr_id in brand.search_attr_ids:
        params.append(("attributesById[]", str(attr_id)))
    params += [
        ("attributeRanges[]", f"constructionYear:{brand.year_from}:null"),
        ("attributeRanges[]", f"PriceCents:null:{brand.price_cents_to}"),
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
def _fetch_page(client: httpx.Client, brand: Brand, offset: int, limit: int) -> dict:
    resp = client.get(config.SEARCH_URL, params=_build_params(brand, offset, limit))
    resp.raise_for_status()
    return resp.json()


def _attr(listing: dict, key: str) -> str:
    for attr in listing.get("attributes", []):
        if attr.get("key") == key:
            return attr.get("value", "") or ""
    return ""


def _canonical_model(listing: dict, brand: Brand) -> str | None:
    """Return the brand's canonical model name, or None to skip the listing.

    Matches the structured `model` attribute first, then the title. For brands
    with fuel/transmission constraints (Skoda) we also guard those, even though
    the server already filtered — cheap insurance against an unexpected straggler.
    """
    model_attr = _attr(listing, "model")
    title = listing.get("title", "")
    matched = None
    for name in brand.models:
        if name in model_attr or name in title:
            matched = name
            break
    if matched is None:
        return None
    if brand.allowed_fuels and _attr(listing, "fuel") not in brand.allowed_fuels:
        return None
    if brand.allowed_transmissions and _attr(listing, "transmission") not in brand.allowed_transmissions:
        return None
    if brand.allowed_bodies and _attr(listing, "body") not in brand.allowed_bodies:
        return None
    return matched


def iter_search_listings(brand: Brand, max_pages: int | None = None) -> Iterator[dict]:
    """Yield raw listing dicts for `brand` (model-guarded), paginating until exhausted."""
    max_pages = max_pages or config.MAX_PAGES
    seen_total: int | None = None
    with _client(brand) as client:
        for page in range(max_pages):
            offset = page * config.PAGE_SIZE
            if seen_total is not None and offset >= seen_total:
                break
            data = _fetch_page(client, brand, offset, config.PAGE_SIZE)
            seen_total = data.get("totalResultCount", 0)
            listings = data.get("listings", [])
            if not listings:
                break
            log.info("[%s] search page %d: %d listings (total=%s)",
                     brand.key, page, len(listings), seen_total)
            for raw in listings:
                model = _canonical_model(raw, brand)
                if model:
                    raw["_brand"] = brand.key
                    raw["_canonical_model"] = model
                    yield raw
            time.sleep(random.uniform(*config.SEARCH_DELAY_RANGE))
