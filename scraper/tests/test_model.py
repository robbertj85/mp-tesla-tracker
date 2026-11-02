"""Tests for the regression's new-stock handling (model.train)."""
import logging

from mp_tesla import model

SPEC = {"numeric": ["age", "mileage_km"], "categorical": ["model"]}


def _rec(i, year, km, price, source="marktplaats"):
    return {"id": f"r{i}", "year": year, "mileage_km": km, "price_eur": price,
            "model": "X", "source": source, "active": True}


def test_new_stock_is_scored_but_not_trained_on(caplog):
    caplog.set_level(logging.WARNING)
    used = [_rec(i, 2020 + i % 5, 20_000 + 7_000 * i, 40_000 - 1_500 * (i % 5) - 0.05 * 7_000 * i)
            for i in range(40)]
    # Catalogue-priced new stock far above the used-car curve.
    new = [_rec(100 + i, 2026, 10, 80_000, source="gaspedaal") for i in range(10)]
    result = model.train(used + new, 2026, SPEC)

    assert result["metrics"]["n"] == len(used)            # trained on used cars only
    for r in new:                                          # ...but new stock is scored
        assert r["id"] in result["predictions"]
        assert result["predictions"][r["id"]]["residualEur"] > 0
    with_new = model.train(used, 2026, SPEC)
    a = result["predictions"]["r3"]["predictedEur"]
    b = with_new["predictions"]["r3"]["predictedEur"]
    assert a == b                                          # used-car prices unaffected
