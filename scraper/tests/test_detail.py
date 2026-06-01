import json
from pathlib import Path

from mp_tesla import detail, record, store, model

FIXTURES = Path(__file__).parent / "fixtures"


def test_parse_real_vip_fixture():
    html = (FIXTURES / "vip_model3_highland.html").read_text(encoding="utf-8")
    d = detail.parse_detail(html)
    assert d["condition"] in ("NEW", "USED", None)
    assert d["color"]  # carAttributes color present
    assert "Highland" in d["description"] or "Achterwielaandrijving" in d["description"]
    assert d["price_cents"] and d["price_cents"] > 0


def test_build_record_from_fixtures():
    search = json.loads((FIXTURES / "search_sample.json").read_text(encoding="utf-8"))
    html = (FIXTURES / "vip_model3_highland.html").read_text(encoding="utf-8")
    det = detail.parse_detail(html)
    raw = search["listings"][0]
    raw["_canonical_model"] = "Model 3" if "Model 3" in raw.get("title", "") else "Model Y"
    rec = record.build_record(raw, det, run_date="2026-06-01")
    assert rec["id"]
    assert rec["model"] in ("Model 3", "Model Y")
    assert rec["price_eur"] is not None
    assert rec["first_seen"] == "2026-06-01"


def test_store_upsert_idempotent(tmp_path):
    rec = {
        "id": "m1", "price_eur": 30000, "model": "Model 3", "year": 2022,
        "mileage_km": 40000, "active": True,
    }
    lp, hp = tmp_path / "listings.json", tmp_path / "price_history.json"
    store.upsert([dict(rec)], "2026-06-01", lp, hp)
    store.upsert([dict(rec)], "2026-06-01", lp, hp)  # same day re-run
    history = json.loads(hp.read_text())
    assert len(history["m1"]) == 1  # no duplicate point

    rec2 = dict(rec, price_eur=28000)
    store.upsert([rec2], "2026-06-02", lp, hp)  # price drop next day
    history = json.loads(hp.read_text())
    assert len(history["m1"]) == 2


def test_model_train_handles_small_data():
    res = model.train([{"id": "m1", "active": True, "price_eur": 30000,
                        "year": 2022, "mileage_km": 40000}], run_year=2026)
    assert res["metrics"]["n"] == 1
    assert res["linearModel"] is None  # not enough data
