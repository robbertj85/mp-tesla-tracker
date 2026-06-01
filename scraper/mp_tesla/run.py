"""CLI orchestrator: scrape -> upsert -> regress -> export.

Usage:
  python -m mp_tesla.run                      # full run
  python -m mp_tesla.run --limit 20           # cap listings (dev)
  python -m mp_tesla.run --no-detail          # skip detail pages (fast, fewer fields)
  python -m mp_tesla.run --run-date 2026-06-01

`--run-date` is injected so the whole pipeline is deterministic and re-runnable
(no wall-clock reads inside the library code).
"""
from __future__ import annotations

import argparse
import logging
import random
import time
from datetime import date, datetime, timezone
from pathlib import Path

from . import config, detail, export, model, record, search, store
from .browser import fetch_html_with_browser

log = logging.getLogger(__name__)

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DATA_DIR = REPO_ROOT / "data"
DEFAULT_WEB_PUBLIC = REPO_ROOT / "web" / "public"


def brand_data_dir(data_dir: Path, brand_key: str) -> Path:
    """Per-brand store directory, e.g. data/tesla/ — keeps brands unmixed."""
    return data_dir / brand_key


def brand_output(web_public: Path, brand_key: str) -> Path:
    """Per-brand exported dataset, e.g. web/public/tesla.json."""
    return web_public / f"{brand_key}.json"


def _fetch_detail(vip_url: str, use_browser: bool) -> dict | None:
    """Fetch + parse a detail page, falling back to a browser only if blocked."""
    try:
        html = detail.fetch_html(vip_url)
        return detail.parse_detail(html)
    except detail.DetailBlocked:
        if not use_browser:
            log.warning("detail blocked (no __CONFIG__): %s", vip_url)
            return None
        try:
            html = fetch_html_with_browser(vip_url)
            return detail.parse_detail(html)
        except Exception as exc:  # pragma: no cover - fallback best-effort
            log.warning("browser fallback failed for %s: %s", vip_url, exc)
            return None
    except Exception as exc:  # pragma: no cover - network best-effort
        log.warning("detail fetch failed for %s: %s", vip_url, exc)
        return None


def _scrape_brand(brand: config.Brand, args, run_date: str, run_year: int) -> None:
    """Scrape → upsert → regress → export one brand into its own store/output."""
    use_browser = not args.no_browser
    records: list[dict] = []
    count = 0
    for raw in search.iter_search_listings(brand):
        if args.limit and count >= args.limit:
            break
        count += 1
        det = None
        if not args.no_detail:
            det = _fetch_detail(raw.get("vipUrl", ""), use_browser)
            time.sleep(random.uniform(*config.DETAIL_DELAY_RANGE))
        rec = record.build_record(raw, det, run_date, brand)
        rec["last_seen"] = run_date
        records.append(rec)
        log.info("[%s %d] %s | %s %s | €%s | %skm | fuel=%s drv=%s",
                 brand.key, count, rec["id"], rec["model"], rec.get("trim") or "",
                 rec.get("price_eur"), rec.get("mileage_km"),
                 rec.get("fuel"), rec.get("drivetrain"))

    log.info("[%s] scraped %d listings; upserting", brand.key, len(records))
    data_dir = brand_data_dir(args.data_dir, brand.key)
    listings_path = data_dir / "listings.json"
    history_path = data_dir / "price_history.json"
    store.upsert(records, run_date, listings_path, history_path)

    # Reload the full store (including still-active listings from prior runs).
    import json
    listings = json.loads(listings_path.read_text(encoding="utf-8"))
    history = json.loads(history_path.read_text(encoding="utf-8"))

    feature_spec = config.FEATURE_SPECS[brand.pipeline]
    model_result = model.train(list(listings.values()), run_year, feature_spec)
    payload = export.build_payload(listings, history, model_result, run_date,
                                   brand.source_query, brand.label)
    export.write_payload(payload, brand_output(args.web_public, brand.key))


def main() -> None:
    parser = argparse.ArgumentParser(description="Marktplaats multi-brand car scraper")
    parser.add_argument("--brand", choices=[*config.BRANDS, "all"], default="all",
                        help="brand to scrape (default: all brands in the registry)")
    parser.add_argument("--limit", type=int, default=None, help="max listings to process per brand")
    parser.add_argument("--no-detail", action="store_true", help="skip detail-page fetch")
    parser.add_argument("--no-browser", action="store_true",
                        help="disable Playwright fallback for blocked pages")
    parser.add_argument("--run-date", default=date.today().isoformat(),
                        help="ISO date stamped on records (default: today)")
    parser.add_argument("--data-dir", type=Path, default=DEFAULT_DATA_DIR)
    parser.add_argument("--web-public", type=Path, default=DEFAULT_WEB_PUBLIC)
    parser.add_argument("-v", "--verbose", action="store_true")
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )

    run_date = args.run_date
    run_year = datetime.fromisoformat(run_date).year
    brand_keys = list(config.BRANDS) if args.brand == "all" else [args.brand]

    for key in brand_keys:
        brand = config.BRANDS[key]
        log.info("=== scraping brand: %s ===", brand.label)
        _scrape_brand(brand, args, run_date, run_year)
    log.info("done.")


if __name__ == "__main__":
    main()
