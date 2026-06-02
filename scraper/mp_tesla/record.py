"""Assemble a normalized listing record from search + detail + heuristics.

Records share a common core (brand, model, year, mileage, price, color, …) plus a
brand-specific block selected by `brand.pipeline`:
  * tesla — trim/Highland/HW/FSD/SoH/range from free-text heuristics.
  * skoda — fuel (Petrol/PHEV) + transmission (Automatic) + drivetrain (FWD/AWD).
Every record carries the union of keys (brand-irrelevant ones are None) so the
exporter and regression frame stay uniform.
"""
from __future__ import annotations

import re

from . import config, extract, infer
from .config import Brand


def _search_attr(raw: dict, key: str):
    for attr in raw.get("attributes", []):
        if attr.get("key") == key:
            return attr.get("value")
    return None


def _to_int(val):
    if val is None:
        return None
    m = re.search(r"\d+", str(val).replace(".", ""))
    return int(m.group()) if m else None


def derive_refresh_trim_hw(model, year, text, drivetrain, power_hp):
    """Compute (is_highland, is_juniper, trim, hw) — the model+year-aware bits.

    Shared by build_record and the re-derive path so the two never drift. A refresh
    needs both its keyword/year signal AND to be no older than its production floor.
    """
    is_highland = (
        model == "Model 3"
        and (extract.detect_highland(text) or (year is not None and year >= config.HIGHLAND_FROM_YEAR))
        and (year is None or year >= config.HIGHLAND_MIN_YEAR)
    )
    is_juniper = (
        model == "Model Y"
        and (extract.detect_juniper(text) or (year is not None and year >= config.JUNIPER_FROM_YEAR))
        and (year is None or year >= config.JUNIPER_MIN_YEAR)
    )
    allow_perf = drivetrain != "RWD" and (power_hp is None or power_hp >= 380)
    base = extract.detect_trim(text, allow_performance=allow_perf)
    suffix = " (Highland)" if is_highland else " (Juniper)" if is_juniper else ""
    trim = (f"{base}{suffix}" if base else suffix.strip(" ()")) or None
    hw = infer.infer_hw_platform(model, year, is_highland, extract.detect_hw_mention(text))
    return is_highland, is_juniper, trim, hw


def _distance_km(meters):
    """Distance from the search postcode in km, or None when unknown (the API
    returns a negative sentinel like -1000 when it can't compute one)."""
    if not isinstance(meters, (int, float)) or meters < 0:
        return None
    return round(meters / 1000)


# Tesla-only fields, defaulted to None on non-Tesla records so the schema is uniform.
_TESLA_NULL_FIELDS = {
    "trim": None, "is_highland": False, "is_juniper": False,
    "hw_platform": None, "hw_source": None, "hw_confidence": None,
    "fsd": False, "autopilot_package": None, "soh_percent": None,
    "range_km": None, "interior_color": None, "upholstery": None,
}


def _normalise_skoda_drivetrain(structured: str | None) -> str | None:
    """Map Marktplaats' Dutch 'Aandrijving' value to FWD / AWD / RWD."""
    if not structured:
        return None
    s = structured.lower()
    if "voorwiel" in s or "fwd" in s or "front" in s:
        return "FWD"
    if "vierwiel" in s or "4wd" in s or "4x4" in s or "awd" in s or "all" in s:
        return "AWD"
    if "achterwiel" in s or "rwd" in s or "rear" in s:
        return "RWD"
    return None


def _derive_tesla(raw: dict, detail: dict, model: str, year, title: str,
                  description: str, power_hp) -> dict:
    heur = extract.extract_all(
        title=title,
        description=description,
        structured_drivetrain=detail.get("drivetrain_attr"),
        structured_color=detail.get("color"),
    )
    text = f"{title}\n{description}"
    drivetrain = heur["drivetrain"]
    is_highland, is_juniper, trim, hw = derive_refresh_trim_hw(
        model, year, text, drivetrain, power_hp
    )
    return {
        "color": heur["color"],
        "drivetrain": drivetrain,
        "fuel": "Electric",
        "transmission": "Automatic",
        "trim": trim,
        "is_highland": is_highland,
        "is_juniper": is_juniper,
        "fsd": heur["fsd"],
        "autopilot_package": heur["autopilot_package"],
        "soh_percent": heur["soh_percent"],
        "hw_platform": hw["value"],
        "hw_source": hw["source"],
        "hw_confidence": hw["confidence"],
        "range_km": detail.get("range_km") or _to_int(_search_attr(raw, "range")),
        "interior_color": detail.get("interior_color"),
        "upholstery": detail.get("upholstery"),
    }


def _derive_skoda(raw: dict, detail: dict) -> dict:
    raw_fuel = (_search_attr(raw, "fuel") or detail.get("fuel") or "")
    fuel = config.FUEL_NORMALISE.get(raw_fuel.strip().lower(), raw_fuel or None)
    drivetrain = _normalise_skoda_drivetrain(detail.get("drivetrain_attr"))
    # Read the actual gearbox so trackers that don't filter on it (e.g. the older
    # Octavia view) can split automatic vs manual. For the Combi tracker, which is
    # filtered to Automaat server-side, this still resolves to "Automatic".
    raw_trans = (_search_attr(raw, "transmission") or detail.get("transmission") or "")
    transmission = config.TRANSMISSION_NORMALISE.get(
        raw_trans.strip().lower(), raw_trans or None
    )
    out = {
        "color": extract.normalise_color(detail.get("color")),
        "drivetrain": drivetrain,
        "fuel": fuel,
        "transmission": transmission,
    }
    out.update(_TESLA_NULL_FIELDS)
    return out


def build_record(raw: dict, detail: dict | None, run_date: str, brand: Brand) -> dict:
    """Merge a search listing (`raw`) with parsed detail (`detail`, may be None).

    `run_date` is an ISO date string supplied by the caller (no wall-clock here,
    so runs are deterministic / re-runnable). The brand selects which derived
    block (Tesla heuristics vs Skoda engine/driveline) is attached.
    """
    detail = detail or {}
    model = raw.get("_canonical_model") or ""

    year = _to_int(detail.get("year")) or _to_int(_search_attr(raw, "constructionYear"))
    mileage = detail.get("mileage_km")
    if mileage is None:
        mileage = _to_int(_search_attr(raw, "mileage"))

    price_cents = detail.get("price_cents") or (raw.get("priceInfo") or {}).get("priceCents")
    price_eur = round(price_cents / 100) if price_cents else None
    price_type = detail.get("price_type") or (raw.get("priceInfo") or {}).get("priceType")

    title = raw.get("title", "")
    description = detail.get("description", "") or raw.get("description", "")

    # Reject implausibly low headline prices (monthly lease / "vanaf" teasers) and
    # try to recover the real asking price from the description instead.
    price_source = "headline"
    if price_eur is None or price_eur < brand.min_price_eur:
        recovered = extract.extract_price_from_text(description)
        if recovered is not None:
            price_eur, price_source = recovered, "description"
        else:
            price_eur, price_source = None, "unreliable"

    power_hp = _to_int(detail.get("power_hp"))

    location = raw.get("location", {}) or {}
    seller = raw.get("sellerInformation", {}) or {}
    images = raw.get("imageUrls") or []
    thumb = images[0] if images else None
    if thumb and thumb.startswith("//"):
        thumb = "https:" + thumb

    rec = {
        "id": raw.get("itemId"),
        "brand": brand.label,
        "url": "https://www.marktplaats.nl" + raw.get("vipUrl", ""),
        "title": title,
        "model": model,
        "year": year,
        "mileage_km": mileage,
        "price_eur": price_eur,
        "price_type": price_type,
        "price_source": price_source,
        "condition": detail.get("condition"),
        "body": detail.get("body") or _search_attr(raw, "body"),
        "power_hp": power_hp,
        "num_doors": _to_int(detail.get("num_doors")),
        "num_seats": _to_int(detail.get("num_seats")),
        "city": location.get("cityName"),
        "distance_km": _distance_km(location.get("distanceMeters")),
        "seller_name": seller.get("sellerName"),
        "seller_id": seller.get("sellerId"),
        "view_count": detail.get("view_count"),
        "favorited_count": detail.get("favorited_count"),
        "post_date": detail.get("post_date"),
        "license_plate": detail.get("license_plate"),
        "thumbnail": thumb,
        # full description kept for debugging + re-derivation without re-scraping
        "description": description,
        # bookkeeping (filled/maintained by store.py)
        "first_seen": run_date,
        "last_seen": run_date,
        "active": True,
    }

    if brand.pipeline == "skoda":
        rec.update(_derive_skoda(raw, detail))
    else:
        rec.update(_derive_tesla(raw, detail, model, year, title, description, power_hp))
    return rec
