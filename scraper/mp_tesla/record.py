"""Assemble a normalized listing record from search + detail + heuristics."""
from __future__ import annotations

import re

from . import config, extract, infer


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


def build_record(raw: dict, detail: dict | None, run_date: str) -> dict:
    """Merge a search listing (`raw`) with parsed detail (`detail`, may be None).

    `run_date` is an ISO date string supplied by the caller (no wall-clock here,
    so runs are deterministic / re-runnable).
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
    if price_eur is None or price_eur < config.MIN_PRICE_EUR:
        recovered = extract.extract_price_from_text(description)
        if recovered is not None:
            price_eur, price_source = recovered, "description"
        else:
            price_eur, price_source = None, "unreliable"

    heur = extract.extract_all(
        title=title,
        description=description,
        structured_drivetrain=detail.get("drivetrain_attr"),
        structured_color=detail.get("color"),
    )

    text = f"{title}\n{description}"
    power_hp = _to_int(detail.get("power_hp"))
    drivetrain = heur["drivetrain"]
    is_highland, is_juniper, trim, hw = derive_refresh_trim_hw(
        model, year, text, drivetrain, power_hp
    )

    location = raw.get("location", {}) or {}
    seller = raw.get("sellerInformation", {}) or {}
    images = raw.get("imageUrls") or []
    thumb = images[0] if images else None
    if thumb and thumb.startswith("//"):
        thumb = "https:" + thumb

    return {
        "id": raw.get("itemId"),
        "url": "https://www.marktplaats.nl" + raw.get("vipUrl", ""),
        "title": title,
        "model": model,
        "trim": trim,
        "is_highland": is_highland,
        "is_juniper": is_juniper,
        "year": year,
        "mileage_km": mileage,
        "price_eur": price_eur,
        "price_type": price_type,
        "price_source": price_source,
        "condition": detail.get("condition"),
        "color": heur["color"],
        "interior_color": detail.get("interior_color"),
        "upholstery": detail.get("upholstery"),
        "body": detail.get("body") or _search_attr(raw, "body"),
        "drivetrain": heur["drivetrain"],
        "power_hp": _to_int(detail.get("power_hp")),
        "range_km": detail.get("range_km") or _to_int(_search_attr(raw, "range")),
        "num_doors": _to_int(detail.get("num_doors")),
        "num_seats": _to_int(detail.get("num_seats")),
        "fsd": heur["fsd"],
        "autopilot_package": heur["autopilot_package"],
        "soh_percent": heur["soh_percent"],
        "hw_platform": hw["value"],
        "hw_source": hw["source"],
        "hw_confidence": hw["confidence"],
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
