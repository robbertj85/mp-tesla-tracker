"""Pull Tesla.com's official used inventory (source="tesla").

Tesla exposes the same JSON its inventory pages render at
``/inventory/api/v4/inventory-results``. That endpoint sits behind Akamai Bot
Manager, so a plain httpx GET is denied. We therefore drive a real browser
(Playwright): load the human inventory page once to clear the bot check, then
call the JSON API *from inside the page context* (``page.evaluate`` + ``fetch``)
so the request carries the page's Akamai cookies and origin.

In practice Tesla's Akamai blocks the automated browser on *any* IP (data-center
and residential alike), so the **reliable path is a manual dump**: open the
inventory page in your normal browser, copy the ``inventory-results`` JSON
response from DevTools → Network, and save it as ``data/tesla_dumps/<slug>.json``
(``my.json`` / ``m3.json`` / ``ms.json``). ``iter_inventory_listings`` ingests
those files through the exact same parser. A live fetch is still attempted for
any model without a dump, but it usually just degrades to zero cars.

Everything here is best-effort: a missing dump, a block, or a missing Playwright
install logs a warning and yields fewer/zero cars — the brand's Marktplaats
scrape is unaffected, so the daily job never fails over Tesla.

The Tesla-API field plumbing lives in ``parse_item`` (messy, defensive); the
canonical record shape + the shared Tesla heuristics live in
``record.build_tesla_record``.
"""
from __future__ import annotations

import json
import logging
import random
import time
from pathlib import Path
from typing import Iterator
from urllib.parse import quote

from . import config, record
from .config import Brand

log = logging.getLogger(__name__)


# --- API query ------------------------------------------------------------------

def _query_url(slug: str, offset: int, count: int) -> str:
    """Build the inventory-results URL for one page of one model."""
    query = {
        "query": {
            "model": slug,
            "condition": "used",
            "options": {},
            "arrangeby": "Price",
            "order": "asc",
            "market": config.TESLA_MARKET,
            "language": config.TESLA_LANGUAGE,
            "super_region": "north america",
            "lng": config.TESLA_LNG,
            "lat": config.TESLA_LAT,
            "zip": config.TESLA_ZIP,
            "range": 0,
            "region": config.TESLA_MARKET,
        },
        "offset": offset,
        "count": count,
        "outsideOffset": 0,
        "outsideSearch": False,
    }
    return f"{config.TESLA_INVENTORY_API}?query=" + quote(
        json.dumps(query, separators=(",", ":"))
    )


def _results_from_payload(payload: dict) -> list[dict]:
    """The `results` field is either a flat list or {exact, approximate}."""
    res = payload.get("results")
    if isinstance(res, dict):
        return (res.get("exact") or []) + (res.get("approximate") or [])
    return res or []


def _loads_multi(text: str):
    """Parse a dump that may hold ONE JSON value or several concatenated ones.

    Hand-saved dumps are often a few `inventory-results` responses pasted one after
    another (`{…}{…}{…}`), which isn't valid single JSON. Fall back to decoding the
    stream object-by-object and return the list of payloads.
    """
    text = text.strip()
    try:
        return json.loads(text)
    except ValueError:
        pass
    dec = json.JSONDecoder()
    out, idx, n = [], 0, len(text)
    while idx < n:
        while idx < n and text[idx].isspace():
            idx += 1
        if idx >= n:
            break
        obj, end = dec.raw_decode(text, idx)
        out.append(obj)
        idx = end
    return out


def _extract_results(obj) -> list[dict]:
    """Pull the car list out of whatever shape a saved dump has: a full API
    payload ({results: …}), a bare results array, or a list of pages/payloads."""
    if isinstance(obj, dict):
        items = _results_from_payload(obj)
    elif isinstance(obj, list):
        if obj and isinstance(obj[0], dict) and "results" in obj[0]:
            items = []
            for page in obj:
                items.extend(_results_from_payload(page))
        else:
            items = obj  # already a list of car items
    else:
        return []
    # Concatenated pages can overlap — dedupe by VIN, keeping first occurrence.
    seen, out = set(), []
    for it in items:
        vin = isinstance(it, dict) and (it.get("VIN") or it.get("Vin"))
        if vin and vin in seen:
            continue
        if vin:
            seen.add(vin)
        out.append(it)
    return out


def _total(payload: dict) -> int | None:
    for key in ("total_matches_found", "total_matches", "count"):
        val = payload.get(key)
        if val is not None:
            try:
                return int(val)
            except (TypeError, ValueError):
                pass
    return None


# --- small field helpers (defensive against API key drift) ----------------------

def _first(item: dict, *keys):
    for k in keys:
        v = item.get(k)
        if v not in (None, "", []):
            return v
    return None


def _int(val):
    if val is None:
        return None
    if isinstance(val, (int, float)):
        return int(val)
    digits = "".join(ch for ch in str(val) if ch.isdigit())
    return int(digits) if digits else None


def _aslist(val) -> list:
    if val is None:
        return []
    return val if isinstance(val, list) else [val]


def _km(odometer, unit) -> int | None:
    n = _int(odometer)
    if n is None:
        return None
    if unit and str(unit).lower().startswith("mi"):
        return round(n * 1.60934)
    return n


def _decode_options(item: dict) -> tuple[list[str], str | None, str | None, str | None]:
    """Walk OptionCodeData → (all names, paint name, interior name, motor/drive name).

    Tesla returns option metadata as a list of dicts with a localized `name` and a
    `group`/`group_name`. We collect every name to feed the text heuristics and pull
    out the paint / interior / drivetrain groups for structured fields.
    """
    names: list[str] = []
    paint = interior = motor = None
    data = item.get("OptionCodeData") or item.get("OptionCodeSpecs") or []
    for opt in data if isinstance(data, list) else []:
        if not isinstance(opt, dict):
            continue
        name = opt.get("name") or opt.get("description")
        if name:
            names.append(str(name))
        group = str(opt.get("group") or opt.get("group_name") or "").upper()
        if not name:
            continue
        if "PAINT" in group and not paint:
            paint = str(name)
        elif "INTERIOR" in group and not interior:
            interior = str(name)
        elif group in ("MOTOR", "DRIVE", "DRIVETRAIN", "BADGE") and not motor:
            motor = str(name)
    return names, paint, interior, motor


def _badge_names(item: dict) -> list[str]:
    out: list[str] = []
    for badge in _aslist(_first(item, "Badges", "BadgeList", "badges")):
        if isinstance(badge, dict):
            name = badge.get("name") or badge.get("title") or badge.get("text")
            if name:
                out.append(str(name))
        elif badge:
            out.append(str(badge))
    return out


def _thumbnail(item: dict) -> str | None:
    photos = _first(item, "VehiclePhotos", "MediaResponse", "images", "Photos")
    for photo in _aslist(photos):
        if isinstance(photo, str) and photo.startswith("http"):
            return photo
        if isinstance(photo, dict):
            url = photo.get("imageUrl") or photo.get("url") or photo.get("src")
            if url:
                return url if url.startswith("http") else "https:" + url
    return None


def parse_item(item: dict, model_name: str, slug: str) -> dict | None:
    """Normalize one raw Tesla inventory result into the intermediate dict that
    record.build_tesla_record consumes. Returns None when the item lacks a VIN."""
    vin = _first(item, "VIN", "Vin", "vin")
    if not vin:
        return None

    names, paint, interior, motor = _decode_options(item)
    trim_name = item.get("TrimName") or " ".join(str(t) for t in _aslist(item.get("TRIM")))
    badges = _badge_names(item)
    # Synthetic blob the free-text heuristics parse like a Marktplaats description.
    spec_text = " ".join(filter(None, [model_name, trim_name, *badges, *names]))

    return {
        "id": f"tesla-{vin}",
        "vin": vin,
        "model": model_name,
        "year": _int(item.get("Year")),
        "mileage_km": _km(_first(item, "Odometer", "OdometerValue"), item.get("OdometerType")),
        "price_eur": _int(_first(item, "InventoryPrice", "Price", "PurchasePrice", "TotalPrice")),
        "url": config.TESLA_ORDER_URL.format(slug=slug, vin=vin),
        "title": f"Tesla {model_name} {trim_name}".strip(),
        "city": _first(item, "City", "MetroName", "VrlName", "StateProvince"),
        "distance_km": _int(_first(item, "DistanceFromSearch", "Distance")),
        # ActualRange is the car-specific rated (WLTP-derived) range Tesla shows on
        # the listing — lower than new = a battery-condition signal.
        "range_km": _km(_first(item, "ActualRange", "Range", "RangeWLTP"),
                        item.get("ActualRangeUnit")),
        "power_hp": None,
        "thumbnail": _thumbnail(item),
        "post_date": None,
        "spec_text": spec_text,
        "color_text": paint,
        "interior_color": interior,
        "drivetrain_text": motor,
        # Model Y is an SUV; M3/MS are sedans — gives the listings a body value.
        "body": "SUV or Terreinwagen" if slug == "my" else "Sedan",
        "soh_percent": None,
        "upholstery": None,
    }


# --- browser-backed fetch -------------------------------------------------------

def _fetch_via_page(page, slug: str, offset: int, count: int) -> dict | None:
    """Fetch one API page from inside the (Akamai-cleared) browser context."""
    url = _query_url(slug, offset, count)
    try:
        result = page.evaluate(
            """async (u) => {
                const r = await fetch(u, {headers: {accept: 'application/json'}, credentials: 'include'});
                return { status: r.status, body: await r.text() };
            }""",
            url,
        )
    except Exception as exc:  # pragma: no cover - network/runtime best-effort
        log.warning("Tesla API eval failed (%s off=%d): %s", slug, offset, exc)
        return None
    status = result.get("status")
    if status != 200:
        log.warning("Tesla API HTTP %s (%s off=%d) — likely Akamai block; skipping",
                    status, slug, offset)
        return None
    try:
        return json.loads(result["body"])
    except (ValueError, TypeError):
        log.warning("Tesla API non-JSON body (%s off=%d) — likely a block page", slug, offset)
        return None


def _iter_from_file(path, slug: str, brand: Brand, run_date: str) -> Iterator[dict]:
    """Yield records from a hand-saved inventory dump (see the module docstring /
    `--tesla-dumps`). This is the reliable path: Tesla's Akamai blocks automated
    API calls, so the user copies the `inventory-results` JSON from their browser."""
    model_name = config.TESLA_MODEL_SLUGS.get(slug, slug)
    try:
        obj = _loads_multi(path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        log.warning("Tesla dump unreadable (%s): %s", path, exc)
        return
    results = _extract_results(obj)
    count = 0
    for item in results:
        parsed = parse_item(item, model_name, slug)
        if parsed is None:
            continue
        yield record.build_tesla_record(parsed, run_date, brand)
        count += 1
    log.info("[%s] Tesla dump %s: %d cars from %s", brand.key, slug, count, path.name)


def _iter_live(slugs: list[str], brand: Brand, run_date: str) -> Iterator[dict]:
    """Best-effort live fetch via Playwright. Tesla's Akamai usually blocks this
    (any IP); on a block it logs a warning and yields fewer/zero cars."""
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:  # pragma: no cover - optional extra
        log.warning("Playwright not installed; skipping live Tesla fetch for %s "
                    "(pip install '.[browser]', or drop dumps in --tesla-dumps)", brand.key)
        return

    timeout_ms = int(config.REQUEST_TIMEOUT * 1000)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(user_agent=config.USER_AGENT, locale="nl-NL")
        ctx.add_init_script(
            "Object.defineProperty(navigator,'webdriver',{get:()=>undefined});"
        )
        page = ctx.new_page()
        try:
            for slug in slugs:
                model_name = config.TESLA_MODEL_SLUGS.get(slug, slug)
                page_url = config.TESLA_INVENTORY_PAGE.format(slug=slug, zip=config.TESLA_ZIP)
                try:
                    page.goto(page_url, wait_until="domcontentloaded", timeout=timeout_ms)
                except Exception as exc:
                    log.warning("Tesla inventory page failed to load (%s): %s", slug, exc)
                    continue
                model_count = 0
                for pg in range(config.TESLA_MAX_PAGES):
                    offset = pg * config.TESLA_PAGE_SIZE
                    payload = _fetch_via_page(page, slug, offset, config.TESLA_PAGE_SIZE)
                    if payload is None:
                        break
                    results = _results_from_payload(payload)
                    if not results:
                        break
                    for item in results:
                        parsed = parse_item(item, model_name, slug)
                        if parsed is None:
                            continue
                        yield record.build_tesla_record(parsed, run_date, brand)
                        model_count += 1
                    total = _total(payload)
                    if total is not None and offset + len(results) >= total:
                        break
                    time.sleep(random.uniform(*config.SEARCH_DELAY_RANGE))
                log.info("[%s] Tesla live %s: %d cars", brand.key, slug, model_count)
        finally:
            browser.close()


def iter_inventory_listings(brand: Brand, run_date: str, limit: int | None = None,
                            dump_dir=None) -> Iterator[dict]:
    """Yield Tesla.com inventory records for `brand`.

    For each model slug we prefer a saved dump (`<dump_dir>/<slug>.json`) — the
    reliable, Akamai-proof path — and fall back to a best-effort live fetch for
    any slug without a dump. Everything is best-effort: a missing dump or a live
    block just yields fewer cars, never an error, so the Marktplaats scrape stands.
    """
    slugs = brand.tesla_inventory_models
    if not slugs:
        return
    dump_dir = Path(dump_dir) if dump_dir else None

    file_slugs: list[tuple[str, Path]] = []
    live_slugs: list[str] = []
    for slug in slugs:
        dump = dump_dir / f"{slug}.json" if dump_dir else None
        if dump and dump.exists():
            file_slugs.append((slug, dump))
        else:
            live_slugs.append(slug)

    emitted = 0
    for slug, dump in file_slugs:
        for rec in _iter_from_file(dump, slug, brand, run_date):
            yield rec
            emitted += 1
            if limit and emitted >= limit:
                log.info("[%s] Tesla inventory hit --limit (%d)", brand.key, limit)
                return
    if live_slugs:
        for rec in _iter_live(live_slugs, brand, run_date):
            yield rec
            emitted += 1
            if limit and emitted >= limit:
                log.info("[%s] Tesla inventory hit --limit (%d)", brand.key, limit)
                return
    log.info("[%s] Tesla inventory total: %d cars", brand.key, emitted)


# --- shape-capture entrypoint ---------------------------------------------------

def _dump(slug: str) -> None:
    """Print one raw API page for `slug` (run from a residential IP). Use to lock
    down the field mapping / build the test fixture."""
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        raise SystemExit("Playwright not installed: pip install '.[browser]'")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(user_agent=config.USER_AGENT, locale="nl-NL")
        ctx.add_init_script("Object.defineProperty(navigator,'webdriver',{get:()=>undefined});")
        page = ctx.new_page()
        page.goto(config.TESLA_INVENTORY_PAGE.format(slug=slug, zip=config.TESLA_ZIP),
                  wait_until="domcontentloaded", timeout=int(config.REQUEST_TIMEOUT * 1000))
        payload = _fetch_via_page(page, slug, 0, config.TESLA_PAGE_SIZE)
        browser.close()
    print(json.dumps(payload, indent=2, ensure_ascii=False))


def _check_file(slug: str, path: str) -> None:
    """Parse a hand-saved dump and report what we'd ingest (validate your save)."""
    from . import config as _cfg
    model_name = _cfg.TESLA_MODEL_SLUGS.get(slug, slug)
    obj = _loads_multi(Path(path).read_text(encoding="utf-8"))
    results = _extract_results(obj)
    parsed = [parse_item(it, model_name, slug) for it in results]
    parsed = [p for p in parsed if p]
    print(f"{len(results)} raw items -> {len(parsed)} parsed {model_name} cars")
    if parsed:
        sample = {k: parsed[0][k] for k in
                  ("id", "model", "year", "mileage_km", "price_eur", "color_text",
                   "drivetrain_text", "url", "spec_text")}
        print(json.dumps(sample, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    import argparse

    ap = argparse.ArgumentParser(description="Tesla inventory helper")
    ap.add_argument("--model", default="my", choices=list(config.TESLA_MODEL_SLUGS))
    ap.add_argument("--dump", action="store_true",
                    help="print one raw API page (best-effort; usually Akamai-blocked)")
    ap.add_argument("--check-file", metavar="PATH",
                    help="parse a hand-saved dump and show what would be ingested")
    a = ap.parse_args()
    logging.basicConfig(level=logging.INFO)
    if a.check_file:
        _check_file(a.model, a.check_file)
    elif a.dump:
        _dump(a.model)
    else:
        ap.error("nothing to do; pass --check-file PATH (or --dump)")
