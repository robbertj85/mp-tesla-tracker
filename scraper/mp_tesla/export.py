"""Export the committed JSON store + model output into web/public/data.json."""
from __future__ import annotations

import json
import logging
from collections import Counter
from pathlib import Path

log = logging.getLogger(__name__)


def _price_trends(listings: dict, history: dict) -> list[dict]:
    """Market-wide price stats per capture day.

    history records a point at first_seen plus one on every later price change,
    so a listing's price on day D is the last point dated <= D. A listing counts
    on day D when first_seen <= D <= last_seen. For each capture day we reduce the
    reconstructed prices of all listings live that day to avg/median/min/max/mode.
    """
    # Every run stamps last_seen on the listings it saw and first_seen on new
    # ones, so their union (plus history dates) is the set of capture days.
    days = set()
    for r in listings.values():
        if r.get("first_seen"):
            days.add(r["first_seen"])
        if r.get("last_seen"):
            days.add(r["last_seen"])
    for pts in history.values():
        for p in pts:
            days.add(p["date"])

    def price_on(rid: str, rec: dict, day: str):
        pts = history.get(rid)
        if pts:
            price = None
            for p in pts:  # points are appended chronologically
                if p["date"] <= day:
                    price = p["priceEur"]
                else:
                    break
            if price is not None:
                return price
        return rec.get("price_eur")

    def median(xs: list[float]):
        s = sorted(xs)
        n = len(s)
        return (s[n // 2] if n % 2 else (s[n // 2 - 1] + s[n // 2]) / 2)

    def mode(xs: list[int]):
        # Most common price; ties broken by the lowest value for stability.
        c = Counter(xs)
        best = max(c.values())
        return min(v for v, n in c.items() if n == best)

    out = []
    for day in sorted(days):
        prices = [
            p for rid, r in listings.items()
            if r.get("first_seen") and r.get("last_seen")
            and r["first_seen"] <= day <= r["last_seen"]
            and (p := price_on(rid, r, day)) is not None
        ]
        if not prices:
            continue
        out.append({
            "date": day,
            "count": len(prices),
            "avg": round(sum(prices) / len(prices)),
            "median": round(median(prices)),
            "min": min(prices),
            "max": max(prices),
            "mode": mode(prices),
        })
    return out


def _facets(active: list[dict]) -> dict:
    def top(key):
        c = Counter(r.get(key) for r in active if r.get(key))
        return [v for v, _ in c.most_common()]
    years = sorted({r["year"] for r in active if r.get("year")})
    return {
        "models": top("model"),
        "trims": top("trim"),
        "colors": top("color"),
        "hwPlatforms": top("hw_platform"),
        "conditions": top("condition"),
        "drivetrains": top("drivetrain"),
        "fuels": top("fuel"),
        "transmissions": top("transmission"),
        "years": years,
    }


def build_payload(listings: dict, history: dict, model_result: dict,
                  run_date: str, source_query: str, brand: str) -> dict:
    # Only ship listings with a trustworthy price (drops lease/teaser rows whose
    # real asking price couldn't be recovered).
    active = [r for r in listings.values()
              if r.get("active", True) and r.get("price_eur") is not None]
    preds = model_result.get("predictions", {})

    out_listings = []
    for r in active:
        rid = r["id"]
        pred = preds.get(rid, {})
        out_listings.append({
            **{k: r.get(k) for k in (
                "id", "brand", "url", "title", "model", "trim", "is_highland", "is_juniper", "year",
                "mileage_km", "price_eur", "price_type", "condition", "color",
                "interior_color", "body", "drivetrain", "fuel", "transmission",
                "power_hp", "range_km",
                "num_seats", "fsd", "autopilot_package", "soh_percent",
                "hw_platform", "hw_source", "hw_confidence", "city", "distance_km",
                "seller_name", "view_count", "favorited_count", "post_date",
                "first_seen", "last_seen", "thumbnail",
            )},
            "predictedEur": pred.get("predictedEur"),
            "residualEur": pred.get("residualEur"),
            "dealLabel": pred.get("dealLabel"),
        })
    out_listings.sort(key=lambda d: (d.get("residualEur") if d.get("residualEur") is not None else 0))

    # Only ship history for currently-active listings (keeps the file lean).
    active_ids = {r["id"] for r in active}
    out_history = {rid: pts for rid, pts in history.items() if rid in active_ids and len(pts) > 1}

    prices = [r["price_eur"] for r in active if r.get("price_eur")]
    mileages = [r["mileage_km"] for r in active if r.get("mileage_km")]

    return {
        "brand": brand,
        "generatedAt": run_date,
        "sourceQuery": source_query,
        "summary": {
            "count": len(active),
            "medianPriceEur": int(sorted(prices)[len(prices) // 2]) if prices else None,
            "avgMileageKm": int(sum(mileages) / len(mileages)) if mileages else None,
            "byModel": dict(Counter(r["model"] for r in active if r.get("model"))),
        },
        "metrics": model_result.get("metrics", {}),
        "importances": model_result.get("importances", []),
        "linearModel": model_result.get("linearModel"),
        "models": model_result.get("models", {}),
        "facets": _facets(active),
        "listings": out_listings,
        "priceHistory": out_history,
        "priceTrends": _price_trends(listings, history),
    }


def write_payload(payload: dict, output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=1) + "\n", encoding="utf-8"
    )
    log.info("wrote %s (%d listings)", output_path, len(payload["listings"]))
