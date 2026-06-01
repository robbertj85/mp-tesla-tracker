"""Export the committed JSON store + model output into web/public/data.json."""
from __future__ import annotations

import json
import logging
from collections import Counter
from pathlib import Path

log = logging.getLogger(__name__)


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
        "years": years,
    }


def build_payload(listings: dict, history: dict, model_result: dict,
                  run_date: str, source_query: str) -> dict:
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
                "id", "url", "title", "model", "trim", "is_highland", "is_juniper", "year",
                "mileage_km", "price_eur", "price_type", "condition", "color",
                "interior_color", "body", "drivetrain", "power_hp", "range_km",
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
        "facets": _facets(active),
        "listings": out_listings,
        "priceHistory": out_history,
    }


def write_payload(payload: dict, output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=1) + "\n", encoding="utf-8"
    )
    log.info("wrote %s (%d listings)", output_path, len(payload["listings"]))
