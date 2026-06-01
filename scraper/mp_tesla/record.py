"""Assemble a normalized listing record from search + detail + heuristics."""
from __future__ import annotations

import re

from . import extract, infer


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

    heur = extract.extract_all(
        title=title,
        description=description,
        structured_drivetrain=detail.get("drivetrain_attr"),
        structured_color=detail.get("color"),
    )

    # Performance is always Dual-Motor AWD with high power; reject the trim when
    # the drivetrain/power contradict it (kills "performance" prose false-hits).
    power_hp = _to_int(detail.get("power_hp"))
    drivetrain = heur["drivetrain"]
    allow_perf = drivetrain != "RWD" and (power_hp is None or power_hp >= 380)
    trim = extract.detect_trim(f"{title}\n{description}", allow_performance=allow_perf)

    hw = infer.infer_hw_platform(
        model=model,
        year=year,
        is_highland=heur["is_highland"],
        explicit_mention=heur["hw_mention"],
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
        "is_highland": heur["is_highland"],
        "year": year,
        "mileage_km": mileage,
        "price_eur": price_eur,
        "price_type": price_type,
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
        "distance_km": round(location.get("distanceMeters", 0) / 1000) or None,
        "seller_name": seller.get("sellerName"),
        "seller_id": seller.get("sellerId"),
        "view_count": detail.get("view_count"),
        "favorited_count": detail.get("favorited_count"),
        "post_date": detail.get("post_date"),
        "license_plate": detail.get("license_plate"),
        "thumbnail": thumb,
        # bookkeeping (filled/maintained by store.py)
        "first_seen": run_date,
        "last_seen": run_date,
        "active": True,
    }
