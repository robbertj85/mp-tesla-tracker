"""Tests for the Tesla.com inventory parser + source-segmented regression.

The fixture (tests/fixtures/tesla_inventory_my.json) is a representative — not
captured — shape of the v4 inventory-results response. Reconcile it with a live
`python -m mp_tesla.tesla_inventory --model my --dump` if Tesla changes field
names; the parser (`parse_item`) is intentionally defensive against drift.
"""
import json
from pathlib import Path

from mp_tesla import config, model, tesla_inventory
from mp_tesla.record import build_tesla_record

FIXTURE = Path(__file__).parent / "fixtures" / "tesla_inventory_my.json"
TESLA = config.BRANDS["tesla"]


def _results():
    payload = json.loads(FIXTURE.read_text(encoding="utf-8"))
    return tesla_inventory._results_from_payload(payload)


def test_results_from_payload_flat_and_split():
    assert len(_results()) == 2
    # dict form {exact, approximate} is flattened too
    split = {"results": {"exact": [{"VIN": "a"}], "approximate": [{"VIN": "b"}]}}
    assert len(tesla_inventory._results_from_payload(split)) == 2


def test_parse_long_range_awd_item():
    parsed = tesla_inventory.parse_item(_results()[0], "Model Y", "my")
    assert parsed["id"] == "tesla-LRWYGCEK9MC070544"
    assert parsed["model"] == "Model Y"
    assert parsed["year"] == 2022
    assert parsed["mileage_km"] == 42000           # already km
    assert parsed["price_eur"] == 38990
    assert parsed["color_text"] == "Pearl White Multi-Coat"
    assert parsed["range_km"] == 505                # ActualRange (km), as Tesla shows it
    assert "Dual Motor" in parsed["spec_text"]
    assert parsed["url"].endswith("/my/order/LRWYGCEK9MC070544?titleStatus=used")
    assert parsed["body"] == "SUV or Terreinwagen"


def test_parse_converts_miles_to_km():
    parsed = tesla_inventory.parse_item(_results()[1], "Model Y", "my")
    assert parsed["mileage_km"] == round(10000 * 1.60934)  # 16093
    assert parsed["range_km"] == round(300 * 1.60934)      # ActualRange in miles -> km


def test_build_tesla_record_runs_shared_heuristics():
    parsed = tesla_inventory.parse_item(_results()[0], "Model Y", "my")
    rec = build_tesla_record(parsed, "2026-06-05", TESLA)
    assert rec["source"] == "tesla"
    assert rec["brand"] == "Tesla"
    assert rec["condition"] == "USED"
    assert rec["fuel"] == "Electric" and rec["transmission"] == "Automatic"
    assert rec["drivetrain"] == "AWD"              # from "Dual Motor"
    assert rec["fsd"] is True                       # Full Self-Driving Capability
    assert rec["color"] == "White"                  # Pearl White -> White
    assert "Long Range" in (rec["trim"] or "")
    assert rec["hw_platform"] == "HW3"              # Model Y 2022 inferred
    # Schema parity: a Tesla record carries every key a Marktplaats record has.
    assert rec["first_seen"] == "2026-06-05" and rec["active"] is True


def test_parse_item_without_vin_is_skipped():
    assert tesla_inventory.parse_item({"Year": 2020}, "Model 3", "m3") is None


# --- source-segmented regression ------------------------------------------------

def _rec(i, source, price):
    """A minimal Tesla-pipeline record sufficient for model._frame."""
    return {
        "id": f"{source}-{i}", "source": source, "model": "Model Y",
        "year": 2022, "mileage_km": 40000 + i * 1000, "price_eur": price,
        "power_hp": 400, "range_km": 500, "trim": "Long Range", "drivetrain": "AWD",
        "hw_platform": "HW3", "fsd": False, "color": "White", "condition": "USED",
        "active": True,
    }


def test_train_emits_source_segmented_models():
    # 20 Marktplaats + 20 Tesla rows (Tesla priced higher) — enough to train each.
    records = [_rec(i, "marktplaats", 30000 + i * 100) for i in range(20)]
    records += [_rec(i, "tesla", 40000 + i * 100) for i in range(20)]
    result = model.train(records, 2026, config.FEATURE_SPECS["tesla"])

    models = result["models"]
    for key in (model.COMBINED_KEY, model.MARKTPLAATS_KEY, model.TESLA_KEY):
        assert key in models
    assert models[model.MARKTPLAATS_KEY]["linearModel"] is not None
    assert models[model.TESLA_KEY]["linearModel"] is not None

    # Every listing scored, each against its own market segment.
    preds = result["predictions"]
    assert preds["marktplaats-0"]["predictedEur"] != preds["tesla-0"]["predictedEur"]
    # Tesla cars (priced higher) predict higher than Marktplaats cars.
    assert preds["tesla-10"]["predictedEur"] > preds["marktplaats-10"]["predictedEur"]


# --- curated WLTP table ---------------------------------------------------------

def test_original_wltp_table_by_model_variant_year():
    from mp_tesla import wltp
    # Long Range carries forward and steps up by year of introduction.
    assert wltp.original_wltp("Model Y", "Long Range", "AWD", 2021) == 505
    assert wltp.original_wltp("Model Y", "Long Range", "AWD", 2023) == 533
    assert wltp.original_wltp("Model Y", "Long Range", "AWD", 2024) == 533  # carry-forward
    assert wltp.original_wltp("Model 3", "Performance", "AWD", 2021) == 567
    assert wltp.original_wltp("Model 3", "Performance", "AWD", 2022) == 547  # re-rated 2022
    # RWD / Standard Range Plus map to the RWD curve.
    assert wltp.original_wltp("Model 3", "Standard Range Plus", "RWD", 2020) == 448
    assert wltp.original_wltp("Model Y", "RWD", "RWD", 2023) == 455
    # Model S base "AWD / Dual Motor" resolves to the Long Range curve.
    assert wltp.original_wltp("Model S", "AWD / Dual Motor", "AWD", 2023) == 634
    # Refresh trims bump the lookup year (Highland LR AWD -> 629; LR RWD -> 702).
    assert wltp.original_wltp("Model 3", "Long Range (Highland)", "AWD", 2023) == 629
    assert wltp.original_wltp("Model 3", "Long Range", "RWD", 2024) == 702
    assert wltp.original_wltp("Model Y", "Long Range", "RWD", 2024) == 600
    # Unknown model/variant -> None (no estimate shown).
    assert wltp.original_wltp("Skoda", "Long Range", "AWD", 2023) is None
    assert wltp.original_wltp("Model Y", "Long Range", "AWD", None) is None
