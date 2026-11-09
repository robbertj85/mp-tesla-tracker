"""Pull dealer stock from Gaspedaal.nl (source="gaspedaal").

Gaspedaal aggregates Dutch dealer listings (AutoScout24, AutoTrack, dealer sites,
lease portals, …). Its search pages are server-rendered Next.js: the first 100
occasions of every page ride along as structured JSON in the flight data
(`self.__next_f.push([1, "…"])` chunks) — year, mileage, kW, price, fuel,
gearbox, body, colour, title suffix and the portals that carry the car.

**robots.txt disallows every URL with a query string** (`Disallow: /*?`), so the
`?page=N` pagination is off-limits. We only fetch path URLs it allows:

  1. the model page            /<make>/<model>
  2. its year slices           /<make>/<model>/<year>      (one per linked year)
  3. on overflow, every other single-filter slice the model page links to
                               /<make>/<model>/<colour|trim|drivetrain|fuel|body>

Each page holds at most 100 cars; the union (by advertentieId) of those slices
covers the whole model as long as no slice is over 100 *and* not partitioned by
another dimension. Coverage per model is logged; for the trackers here it is
normally complete or close to it.

Gaspedaal has no free-text description, so equipment flags and variants come from
the title only (seller titles usually carry the battery/variant and the headline
options). Everything is best-effort: a block or parse error logs a warning and
yields fewer cars — the brand's Marktplaats scrape is never affected.
"""
from __future__ import annotations

import json
import logging
import random
import re
import time
from typing import Iterable, Iterator

import httpx

from . import config, record
from .config import Brand

log = logging.getLogger(__name__)

_PUSH_RE = re.compile(r'self\.__next_f\.push\(\[1,"(.*?)"\]\)</script>', re.S)
_ITEMS_RE = re.compile(r'"numberOfItems":(\d+)')

# Title cues that split Gaspedaal's single "HYBRIDE" fuel into plug-in vs mild.
_PHEV_RE = re.compile(r"\biv\b|phev|plug[\s-]*in|e-?hybrid", re.I)
_MHEV_RE = re.compile(r"mhev|mild|e-?tec\b|e-?tsi\b", re.I)
_AWD_RE = re.compile(r"\bawd\b|4x4|4\s*motion|vierwiel|dual\s*motor|\be4x\b|all[\s-]*wheel|quattro", re.I)
_RWD_RE = re.compile(r"\brwd\b|achterwiel|rear[\s-]*wheel|single\s*motor", re.I)


# --- page parsing -----------------------------------------------------------------

def _flight_text(html: str) -> str:
    """Concatenate (and JSON-unescape) every Next.js flight-data chunk."""
    parts = []
    for m in _PUSH_RE.finditer(html):
        try:
            parts.append(json.loads(f'"{m.group(1)}"'))
        except ValueError:
            continue
    return "".join(parts)


def parse_page(html: str, path: str) -> dict:
    """Parse one search page into {occasions, total, slices}.

    `total` is the slice's full match count (the page itself shows ≤100);
    `slices` are the single-filter sub-paths the page links to (`/<path>/<slug>`).
    """
    flight = _flight_text(html)
    occasions: list[dict] = []
    key = '"occasions":['
    idx = flight.find(key)
    if idx >= 0:
        try:
            occasions, _ = json.JSONDecoder().raw_decode(flight, idx + len(key) - 1)
        except ValueError:
            log.warning("gaspedaal: occasions JSON unreadable on /%s", path)
    m = _ITEMS_RE.search(html)
    total = int(m.group(1)) if m else len(occasions)
    slices = sorted(set(re.findall(rf'href="/{re.escape(path)}/([a-z0-9-]+)"', html)))
    return {"occasions": occasions, "total": total, "slices": slices}


# --- occasion -> record --------------------------------------------------------

def _get(d, *keys):
    """Nested get that treats Next.js "$undefined" placeholders as missing."""
    for k in keys:
        if not isinstance(d, dict):
            return None
        d = d.get(k)
    if isinstance(d, str) and d.startswith("$"):
        return None
    return d


def _fuel(raw_fuel: str | None, title: str, power_hp: int | None) -> str | None:
    """Gaspedaal fuel enum -> Marktplaats label (HYBRIDE split on the title)."""
    if not raw_fuel:
        return None
    if raw_fuel == "HYBRIDE":
        if _PHEV_RE.search(title):
            return "Hybride Elektrisch/Benzine"
        if _MHEV_RE.search(title):
            return "Benzine"
        # No cue: Skoda's plug-ins make 204+ hp, its mild hybrids ≤150 hp.
        return "Hybride Elektrisch/Benzine" if (power_hp or 0) >= 200 else "Benzine"
    return config.GASPEDAAL_FUEL.get(raw_fuel, raw_fuel.title())


# Power figures (hp) that only exist as all-wheel drive, per pipeline: the Enyaq
# 80x / RS / 85x and the ID.4 Pro 4MOTION / GTX. Their titles rarely say "AWD".
_AWD_ONLY_HP = {"enyaq": {265, 299, 300, 340}, "id4": {265, 299, 300, 340}}
# The driveline every other car of the pipeline has (Octavia/Superb are FWD unless
# 4x4; the MEB EVs are RWD unless dual-motor; the Niro EV is FWD only). Tesla/Mach-E: read from the title.
_DEFAULT_DRIVETRAIN = {"skoda": "Voorwielaandrijving", "enyaq": "Achterwielaandrijving",
                       "id4": "Achterwielaandrijving", "niro": "Voorwielaandrijving"}


def _drivetrain_attr(title: str, power_hp: int | None, pipeline: str | None) -> str | None:
    """Gaspedaal has no driveline field; read it from the title (and the power for
    AWD-only variants), phrased like Marktplaats' 'Aandrijving' value so the shared
    normaliser maps it."""
    if _AWD_RE.search(title) or power_hp in _AWD_ONLY_HP.get(pipeline, ()):
        return "Vierwielaandrijving"
    if pipeline == "id4" and re.search(r"\bgtx\b", title, re.I):
        return "Vierwielaandrijving"
    if _RWD_RE.search(title):
        return "Achterwielaandrijving"
    return _DEFAULT_DRIVETRAIN.get(pipeline)


def _portal_url(occ: dict) -> str | None:
    portals = occ.get("portalen") or []
    by_name = {p.get("portaalBeschrijving"): p.get("klikUrl") for p in portals}
    for name in config.GASPEDAAL_PORTAL_ORDER:
        if by_name.get(name):
            return by_name[name]
    return next((p.get("klikUrl") for p in portals if p.get("klikUrl")), None)


def parse_occasion(occ: dict, model_name: str, pipeline: str | None = None) -> dict | None:
    """Normalise one Gaspedaal occasion into the intermediate dict that
    record.build_gaspedaal_record consumes (Marktplaats-labelled fields).
    `pipeline` (Brand.pipeline) picks the driveline default."""
    ad_id = occ.get("advertentieId")
    if not ad_id:
        return None
    alg = _get(occ, "autogegevens", "algemeen") or {}
    title = " ".join(filter(None, [alg.get("merknaam"), alg.get("modelnaam"),
                                   _get(alg, "uitvoering")])).strip()
    kw = _get(occ, "autogegevens", "motor", "vermogenKw")
    power_hp = round(kw * 1.35962) if isinstance(kw, (int, float)) and kw > 0 else None
    km = _get(occ, "autogegevens", "geschiedenis", "kilometerstand")
    colour = _get(alg, "kleur")
    return {
        "id": f"gp-{ad_id}",
        "model": model_name,
        "title": title,
        "year": _get(occ, "autogegevens", "geschiedenis", "bouwjaar"),
        "mileage_km": km,
        "price_eur": _get(occ, "prijs", "totaalInclusiefBtw"),
        "power_hp": power_hp,
        "fuel": _fuel(_get(alg, "brandstofsoort"), title, power_hp),
        "transmission": config.GASPEDAAL_TRANSMISSION.get(_get(alg, "transmissietype") or ""),
        "body": config.GASPEDAAL_BODY.get(_get(alg, "carrosserievorm") or ""),
        "color": colour.lower() if colour else None,
        "drivetrain_attr": _drivetrain_attr(title, power_hp, pipeline),
        "num_doors": _get(alg, "aantalDeuren"),
        # No condition field: a car with (almost) no kilometres is new stock.
        "condition": "NEW" if isinstance(km, int) and km <= 1000 else "USED",
        "city": _get(occ, "aanbieder", "aanbiedergegevens", "plaatsnaam"),
        "seller_name": _get(occ, "aanbieder", "aanbiedergegevens", "naamsvermelding") or None,
        "post_date": _get(occ, "datumGeplaatst"),
        "thumbnail": _get(occ, "gpFotos", "fotoGroot"),
        "url": _portal_url(occ),
        "portals": [p.get("portaalBeschrijving") for p in occ.get("portalen") or []
                    if p.get("portaalBeschrijving")],
    }


def in_scope(parsed: dict, brand: Brand) -> bool:
    """Apply the brand's search scope (what Marktplaats filters server-side)."""
    year, price, km = parsed.get("year"), parsed.get("price_eur"), parsed.get("mileage_km")
    if year is None or price is None or km is None:
        return False
    if year < brand.year_from or (brand.year_to is not None and year > brand.year_to):
        return False
    if price < brand.min_price_eur or price * 100 > brand.price_cents_to:
        return False
    if brand.mileage_to is not None and km > brand.mileage_to:
        return False
    if brand.allowed_fuels and parsed.get("fuel") not in brand.allowed_fuels:
        return False
    if brand.allowed_transmissions and parsed.get("transmission") not in brand.allowed_transmissions:
        return False
    if brand.allowed_bodies and parsed.get("body") not in brand.allowed_bodies:
        return False
    if brand.title_exclude and re.search(brand.title_exclude, parsed.get("title") or "", re.I):
        return False
    return True


# --- de-duplication against the other sources ---------------------------------

def dedup_key(year, mileage_km, city) -> tuple | None:
    """Identity of a physical car across portals.

    Most Marktplaats dealer ads are the same feed Gaspedaal aggregates, with the
    exact same odometer reading — so (build year, km) is unique enough for used
    cars. New stock all reads ~10 km, so there the dealer's town joins the key.
    """
    if year is None or mileage_km is None:
        return None
    if mileage_km >= 1000:
        return (year, mileage_km)
    return (year, mileage_km, (city or "").strip().lower())


# Fuzzy tolerance for the same used car listed on two portals a day or two apart:
# the odometer and price get updated in one feed before the other.
FUZZY_KM = 500
FUZZY_PRICE_PCT = 0.03


class SeenCars:
    """Cars already scraped this run: exact keys plus a fuzzy (build year, km ±500,
    price ±3%) match for used cars whose details drifted between portals."""

    def __init__(self, records: Iterable[dict] = ()):
        self._keys: set[tuple] = set()
        self._used: dict[int, list[tuple[int, int]]] = {}
        for r in records:
            self.add(r.get("year"), r.get("mileage_km"), r.get("city"), r.get("price_eur"))

    def add(self, year, mileage_km, city, price) -> None:
        key = dedup_key(year, mileage_km, city)
        if key is None:
            return
        self._keys.add(key)
        if mileage_km >= 1000 and price:
            self._used.setdefault(year, []).append((mileage_km, price))

    def __contains__(self, car: tuple) -> bool:
        year, mileage_km, city, price = car
        key = dedup_key(year, mileage_km, city)
        if key is None:
            return False
        if key in self._keys:
            return True
        if mileage_km < 1000 or not price:
            return False
        return any(abs(k - mileage_km) <= FUZZY_KM and abs(p - price) <= FUZZY_PRICE_PCT * price
                   for k, p in self._used.get(year, ()))


# --- fetching -------------------------------------------------------------------

def _client() -> httpx.Client:
    return httpx.Client(
        headers={
            "User-Agent": config.USER_AGENT,
            "Accept": "text/html,application/xhtml+xml",
            "Accept-Language": "nl-NL,nl;q=0.9,en;q=0.8",
        },
        timeout=config.REQUEST_TIMEOUT,
        follow_redirects=True,
    )


def _fetch(client: httpx.Client, path: str) -> dict | None:
    """GET one robots-allowed path (no query string) and parse it; None on 404/error."""
    url = f"{config.GASPEDAAL_BASE_URL}/{path}"
    for attempt in range(3):
        try:
            resp = client.get(url)
        except httpx.TransportError as exc:
            log.warning("gaspedaal: %s failed (%s), attempt %d", url, exc, attempt + 1)
            time.sleep(5 * (attempt + 1))
            continue
        if resp.status_code == 404:
            return None
        if resp.status_code != 200:
            log.warning("gaspedaal: HTTP %s on %s, attempt %d", resp.status_code, url, attempt + 1)
            time.sleep(10 * (attempt + 1))
            continue
        return parse_page(resp.text, path)
    return None


def _pause() -> None:
    time.sleep(random.uniform(*config.SEARCH_DELAY_RANGE))


def collect_model(client: httpx.Client, path: str, brand: Brand) -> tuple[dict[int, dict], int, int]:
    """Union the model page and its slices. Returns ({adId: occ}, model total, pages)."""
    base = _fetch(client, path)
    if base is None:
        log.warning("gaspedaal: model page /%s unavailable; skipping", path)
        return {}, 0, 1
    found = {o["advertentieId"]: o for o in base["occasions"] if o.get("advertentieId")}
    pages = 1
    if base["total"] <= len(base["occasions"]):
        return found, base["total"], pages  # fits on one page: complete

    year_to = brand.year_to if brand.year_to is not None else 9999
    years = [s for s in base["slices"] if s.isdigit() and brand.year_from <= int(s) <= year_to]
    overflow = False
    year_sum = 0
    for y in years:
        _pause()
        page = _fetch(client, f"{path}/{y}")
        pages += 1
        if page is None:
            continue
        year_sum += page["total"]
        overflow |= page["total"] > len(page["occasions"])
        for o in page["occasions"]:
            if o.get("advertentieId"):
                found[o["advertentieId"]] = o
    # The model page only links its most common years: cars of the other years
    # (and of any year holding more than one page) are reached through the
    # non-year slices instead.
    overflow |= year_sum < base["total"]

    if overflow:
        # A year holds more than one page: partition it by the other facets the
        # model page links to (colour, trim, driveline, …) and keep the union.
        for s in base["slices"]:
            if s.isdigit():
                continue
            _pause()
            page = _fetch(client, f"{path}/{s}")
            pages += 1
            if page is None:
                continue
            for o in page["occasions"]:
                if o.get("advertentieId"):
                    found[o["advertentieId"]] = o
    return found, base["total"], pages


def iter_listings(brand: Brand, run_date: str, limit: int | None = None,
                  seen: SeenCars | None = None,
                  stats: dict | None = None) -> Iterator[dict]:
    """Yield Gaspedaal records for `brand`, skipping cars already scraped from
    another source this run (`seen`, see SeenCars). `stats["found"]` counts
    every car the crawl saw (before scope/dedup) so the caller can tell an empty
    result from a failed crawl."""
    if not brand.gaspedaal_models:
        return
    seen = seen if seen is not None else SeenCars()
    stats = stats if stats is not None else {}
    stats.setdefault("found", 0)
    emitted = 0
    with _client() as client:
        for model_name, path in brand.gaspedaal_models:
            try:
                found, total, pages = collect_model(client, path, brand)
            except Exception:  # pragma: no cover - best-effort source
                log.exception("gaspedaal: /%s crawl failed", path)
                continue
            stats["found"] += len(found)
            scoped = dupes = 0
            for occ in found.values():
                parsed = parse_occasion(occ, model_name, brand.pipeline)
                if parsed is None:
                    continue
                if not in_scope(parsed, brand):
                    continue
                scoped += 1
                car = (parsed["year"], parsed["mileage_km"], parsed["city"], parsed["price_eur"])
                if car in seen:
                    dupes += 1
                    continue
                seen.add(*car)  # also dedupes Gaspedaal against itself
                yield record.build_gaspedaal_record(parsed, run_date, brand)
                emitted += 1
                if limit and emitted >= limit:
                    log.info("[%s] gaspedaal hit --limit (%d)", brand.key, limit)
                    return
            log.info("[%s] gaspedaal /%s: %d pages, %d/%d cars reached (%.0f%%); %d in "
                     "scope, %d already on Marktplaats/Tesla, %d new", brand.key, path,
                     pages, len(found), total, 100 * len(found) / max(total, 1),
                     scoped, dupes, scoped - dupes)
            _pause()
