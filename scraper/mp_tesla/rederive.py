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

from . import export, model, record
from .run import DEFAULT_DATA_DIR, DEFAULT_OUTPUT, SOURCE_QUERY

log = logging.getLogger(__name__)


def main() -> None:
    parser = argparse.ArgumentParser(description="Re-derive features from stored data")
    parser.add_argument("--run-date", default=date.today().isoformat())
    parser.add_argument("--data-dir", type=Path, default=DEFAULT_DATA_DIR)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")

    listings_path = args.data_dir / "listings.json"
    history_path = args.data_dir / "price_history.json"
    listings = json.loads(listings_path.read_text(encoding="utf-8"))
    history = json.loads(history_path.read_text(encoding="utf-8"))

    changed = 0
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
    log.info("re-derived %d/%d records changed", changed, len(listings))

    run_year = datetime.fromisoformat(args.run_date).year
    result = model.train(list(listings.values()), run_year)
    payload = export.build_payload(listings, history, result, args.run_date, SOURCE_QUERY)
    export.write_payload(payload, args.output)


if __name__ == "__main__":
    main()
