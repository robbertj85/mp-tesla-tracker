import json
from pathlib import Path

from mp_tesla import config, detail, record, store, model

FIXTURES = Path(__file__).parent / "fixtures"
TESLA = config.BRANDS["tesla"]
SKODA = config.BRANDS["skoda"]


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
    rec = record.build_record(raw, det, "2026-06-01", TESLA)
    assert rec["id"]
    assert rec["brand"] == "Tesla"
    assert rec["model"] in ("Model 3", "Model Y")
    assert rec["price_eur"] is not None
    assert rec["fuel"] == "Electric"
    assert rec["transmission"] == "Automatic"
    assert rec["first_seen"] == "2026-06-01"


def test_build_record_skoda():
    """A Skoda search listing yields fuel/transmission/drivetrain and no HW/FSD."""
    raw = {
        "itemId": "s1",
        "title": "Skoda Octavia 1.4 TSI iV PHEV DSG",
        "vipUrl": "/v/auto-s/skoda/s1",
        "priceInfo": {"priceCents": 2399500, "priceType": "FIXED"},
        "attributes": [
            {"key": "constructionYear", "value": "2022"},
            {"key": "mileage", "value": "60.000"},
            {"key": "fuel", "value": "Hybride Elektrisch/Benzine"},
            {"key": "transmission", "value": "Automaat"},
            {"key": "model", "value": "Octavia"},
        ],
        "_brand": "skoda",
        "_canonical_model": "Octavia",
    }
    det = {"power_hp": "204", "drivetrain_attr": "Voorwielaandrijving", "condition": "USED"}
    rec = record.build_record(raw, det, "2026-06-01", SKODA)
    assert rec["brand"] == "Skoda"
    assert rec["model"] == "Octavia"
    assert rec["fuel"] == "PHEV"
    assert rec["transmission"] == "Automatic"
    assert rec["drivetrain"] == "FWD"
    assert rec["price_eur"] == 23995
    assert rec["mileage_km"] == 60000
    # No Tesla-only signals leak into a Skoda record.
    assert rec["hw_platform"] is None
    assert rec["trim"] is None
    assert rec["fsd"] is False


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
                        "year": 2022, "mileage_km": 40000}], 2026,
                       config.FEATURE_SPECS["tesla"])
    assert res["metrics"]["n"] == 1
    assert res["linearModel"] is None  # not enough data


def test_skoda_search_guard():
    """The Skoda canonical-model guard requires an allowed fuel + transmission."""
    from mp_tesla import search
    ok = {"title": "Skoda Superb", "attributes": [
        {"key": "model", "value": "Superb"},
        {"key": "fuel", "value": "Benzine"},
        {"key": "transmission", "value": "Automaat"}]}
    diesel = {"title": "Skoda Superb", "attributes": [
        {"key": "model", "value": "Superb"},
        {"key": "fuel", "value": "Diesel"},
        {"key": "transmission", "value": "Automaat"}]}
    manual = {"title": "Skoda Octavia", "attributes": [
        {"key": "model", "value": "Octavia"},
        {"key": "fuel", "value": "Benzine"},
        {"key": "transmission", "value": "Handgeschakeld"}]}
    assert search._canonical_model(ok, SKODA) == "Superb"
    assert search._canonical_model(diesel, SKODA) is None
    assert search._canonical_model(manual, SKODA) is None
