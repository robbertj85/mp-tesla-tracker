"""Idempotent JSON store: upsert listings and append price history.

No database — two committed JSON files under data/:
  - listings.json:       {id: record}
  - price_history.json:  {id: [{"date", "priceEur"}]}

Re-running on the same day is a no-op for history (same price -> no new point;
same date -> existing point updated in place), so the daily Action stays clean.
"""
from __future__ import annotations

import json
import logging
from pathlib import Path

log = logging.getLogger(__name__)

# Listings absent for this many consecutive runs are marked inactive (sold/removed).
INACTIVE_AFTER_MISSING_RUNS = 2


def _load(path: Path) -> dict:
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return {}


def _dump(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(data, ensure_ascii=False, indent=1, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def upsert(
    records: list[dict],
    run_date: str,
    listings_path: Path,
    history_path: Path,
) -> dict:
    """Merge `records` into the store. Returns a small summary dict."""
    listings = _load(listings_path)
    history = _load(history_path)

    seen_ids = set()
    added = updated = price_changes = 0

    for rec in records:
        rid = rec["id"]
        if not rid:
            continue
        seen_ids.add(rid)
        existing = listings.get(rid)

        if existing is None:
            rec["first_seen"] = run_date
            rec["runs_missing"] = 0
            listings[rid] = rec
            added += 1
        else:
            rec["first_seen"] = existing.get("first_seen", run_date)
            rec["runs_missing"] = 0
            listings[rid] = rec
            updated += 1

        # Price history: append only when the price actually changed.
        price = rec.get("price_eur")
        if price is not None:
            series = history.setdefault(rid, [])
            if not series:
                series.append({"date": run_date, "priceEur": price})
                price_changes += 1
            else:
                last = series[-1]
                if last["date"] == run_date:
                    last["priceEur"] = price  # same-day re-run: correct in place
                elif last["priceEur"] != price:
                    series.append({"date": run_date, "priceEur": price})
                    price_changes += 1

    # Age out listings not seen this run.
    deactivated = 0
    for rid, rec in listings.items():
        if rid in seen_ids:
            continue
        rec["runs_missing"] = rec.get("runs_missing", 0) + 1
        if rec["runs_missing"] >= INACTIVE_AFTER_MISSING_RUNS and rec.get("active", True):
            rec["active"] = False
            deactivated += 1

    _dump(listings_path, listings)
    _dump(history_path, history)

    summary = {
        "total": len(listings),
        "added": added,
        "updated": updated,
        "price_changes": price_changes,
        "deactivated": deactivated,
        "active": sum(1 for r in listings.values() if r.get("active", True)),
    }
    log.info("store upsert: %s", summary)
    return summary
