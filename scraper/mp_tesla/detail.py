"""Fetch and parse a listing's VIP (detail) page.

The page embeds a `window.__CONFIG__ = {...}` blob holding the full structured
`listing` object (carAttributes, carDetails, stats, ...). The free-text
description lives in a `class="Description..."` block in the HTML body. We parse
both. If a plain request looks blocked (no __CONFIG__), the caller can retry via
the Playwright fallback in browser.py.
"""
from __future__ import annotations

import html as ihtml
import json
import logging
import re

import httpx
from selectolax.parser import HTMLParser
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from . import config

log = logging.getLogger(__name__)

_CONFIG_RE = re.compile(r"window\.__CONFIG__\s*=\s*")


class DetailBlocked(Exception):
    """Raised when the page came back without the expected payload (likely WAF)."""


def _client() -> httpx.Client:
    return httpx.Client(
        headers={
            "User-Agent": config.USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "nl-NL,nl;q=0.9,en;q=0.8",
            "Referer": f"{config.BASE_URL}/l/auto-s/tesla/",
        },
        timeout=config.REQUEST_TIMEOUT,
        follow_redirects=True,
    )


@retry(
    retry=retry_if_exception_type((httpx.HTTPStatusError, httpx.TransportError)),
    wait=wait_exponential(multiplier=1.5, min=2, max=30),
    stop=stop_after_attempt(config.MAX_RETRIES),
    reraise=True,
)
def fetch_html(vip_url: str) -> str:
    url = vip_url if vip_url.startswith("http") else config.BASE_URL + vip_url
    with _client() as client:
        resp = client.get(url)
        resp.raise_for_status()
        return resp.text


def extract_config(html: str) -> dict | None:
    """Pull and parse the `window.__CONFIG__` listing object, or None."""
    m = _CONFIG_RE.search(html)
    if not m:
        return None
    start = m.end()
    end = html.find("</script>", start)
    raw = html[start:end].strip()
    if raw.endswith(";"):
        raw = raw[:-1]
    try:
        return json.loads(raw).get("listing")
    except json.JSONDecodeError:
        return None


def extract_description(html: str) -> str:
    """Return the cleaned plain-text description from the Description block."""
    tree = HTMLParser(html)
    # The description body renders in `<div class="Description-description">`
    # (a sibling `Description-title` holds the "Beschrijving" heading — skip it).
    node = (
        tree.css_first('[class*="Description-description"]')
        or tree.css_first('#description')
    )
    if node is None:
        # Fall back to the meta description (truncated but better than nothing).
        meta = tree.css_first('meta[name="description"]')
        return ihtml.unescape(meta.attributes.get("content", "")) if meta else ""
    text = node.text(separator=" ")
    text = ihtml.unescape(re.sub(r"\s+", " ", text)).strip()
    # Drop the leading "Beschrijving" heading if present.
    return re.sub(r"^Beschrijving\s*", "", text)


def flatten_car_attributes(listing: dict) -> dict:
    """Flatten carAttributes.groupedWithIcons into a {key: value} dict."""
    out: dict = {}
    car_attrs = (listing or {}).get("carAttributes", {}) or {}
    for group in car_attrs.get("groupedWithIcons", []):
        for attr in group.get("attributes", []):
            key = attr.get("key")
            if key and key not in out:
                out[key] = attr.get("value")
    return out


def parse_detail(html: str) -> dict:
    """Return structured detail fields + description. Raises DetailBlocked if empty."""
    listing = extract_config(html)
    if listing is None:
        raise DetailBlocked("no __CONFIG__ payload in page")
    flat = flatten_car_attributes(listing)
    car_details = listing.get("carDetails", {}) or {}
    stats = listing.get("stats", {}) or {}
    price = listing.get("priceInfo", {}) or {}
    return {
        "description": extract_description(html),
        "year": _to_int(flat.get("constructionYear") or car_details.get("constructionYear")),
        "mileage_km": _to_int(flat.get("mileage")),
        "condition": car_details.get("condition"),
        "license_plate": car_details.get("licensePlate") or None,
        "color": flat.get("color"),
        "interior_color": flat.get("interiorColor"),
        "upholstery": flat.get("upholstery"),
        "body": flat.get("vehicleType"),
        "power_hp": flat.get("powerInHorsePower"),
        "num_doors": flat.get("numberOfDoors"),
        "num_seats": flat.get("numberOfSeats"),
        # `powerWheelDriver` holds Achterwiel/Vierwiel; extract.detect_drivetrain maps it.
        "drivetrain_attr": flat.get("powerWheelDriver") or flat.get("driveTrain"),
        "range_km": _to_int(flat.get("actionRadius") or flat.get("range")),
        "view_count": stats.get("viewCount"),
        "favorited_count": stats.get("favoritedCount"),
        "post_date": stats.get("since"),
        "price_cents": price.get("priceCents"),
        "price_type": price.get("priceType"),
    }


def _to_int(val) -> int | None:
    if val is None:
        return None
    # Dutch numbers use '.' as a thousands separator (e.g. "240.858" km).
    s = str(val).replace(".", "")
    m = re.search(r"\d+", s)
    return int(m.group()) if m else None
