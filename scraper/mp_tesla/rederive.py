"""Recompute derived fields from the stored data and re-export — no network.

Because each record keeps its raw `description`, tweaks to the trim/refresh/HW
heuristics can be applied to the existing dataset without re-scraping Marktplaats.

Usage: python -m mp_tesla.rederive [--run-date YYYY-MM-DD]
"""
from __future__ import annotations

import argparse
import json
import logging
from datetime import date, datetime
from pathlib import Path

from . import config, export, model, record
from .run import DEFAULT_DATA_DIR, DEFAULT_WEB_PUBLIC, brand_data_dir, brand_output

log = logging.getLogger(__name__)


def _rederive_brand(brand: config.Brand, args, run_year: int) -> None:
    data_dir = brand_data_dir(args.data_dir, brand.key)
    listings_path = data_dir / "listings.json"
    history_path = data_dir / "price_history.json"
    if not listings_path.exists():
        log.info("[%s] no store yet (%s); skipping", brand.key, listings_path)
        return
    listings = json.loads(listings_path.read_text(encoding="utf-8"))
    history = json.loads(history_path.read_text(encoding="utf-8"))

    # Backfill brand/fuel/transmission on records stored before the multi-brand
    # schema (Tesla is electric + automatic).
    for rec in listings.values():
        rec.setdefault("brand", brand.label)
        # Records stored before the Tesla-inventory source all came from Marktplaats.
        rec.setdefault("source", "marktplaats")
        if brand.pipeline == "tesla":
            rec.setdefault("fuel", "Electric")
            rec.setdefault("transmission", "Automatic")

    # Only Tesla has free-text-derived fields (trim/Highland/HW) to recompute.
    changed = 0
    if brand.pipeline == "tesla":
        for rec in listings.values():
            text = f"{rec.get('title', '')}\n{rec.get('description', '')}"
            is_highland, is_juniper, trim, hw = record.derive_refresh_trim_hw(
                rec.get("model", ""), rec.get("year"), text,
                rec.get("drivetrain"), rec.get("power_hp"),
            )
            before = (rec.get("trim"), rec.get("is_highland"), rec.get("hw_platform"))
            rec.update({
                "is_highland": is_highland, "is_juniper": is_juniper, "trim": trim,
                "hw_platform": hw["value"], "hw_source": hw["source"],
                "hw_confidence": hw["confidence"],
            })
            if before != (rec["trim"], rec["is_highland"], rec["hw_platform"]):
                changed += 1
        listings_path.write_text(
            json.dumps(listings, ensure_ascii=False, indent=1, sort_keys=True) + "\n",
            encoding="utf-8",
        )
    log.info("[%s] re-derived %d/%d records changed", brand.key, changed, len(listings))

    feature_spec = config.FEATURE_SPECS[brand.pipeline]
    result = model.train(list(listings.values()), run_year, feature_spec)
    payload = export.build_payload(listings, history, result, args.run_date,
                                   brand.source_query, brand.label)
    export.write_payload(payload, brand_output(args.web_public, brand.key))


def main() -> None:
    parser = argparse.ArgumentParser(description="Re-derive features from stored data")
    parser.add_argument("--brand", choices=[*config.BRANDS, "all"], default="all")
    parser.add_argument("--run-date", default=date.today().isoformat())
    parser.add_argument("--data-dir", type=Path, default=DEFAULT_DATA_DIR)
    parser.add_argument("--web-public", type=Path, default=DEFAULT_WEB_PUBLIC)
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")

    run_year = datetime.fromisoformat(args.run_date).year
    brand_keys = list(config.BRANDS) if args.brand == "all" else [args.brand]
    for key in brand_keys:
        _rederive_brand(config.BRANDS[key], args, run_year)


if __name__ == "__main__":
    main()
