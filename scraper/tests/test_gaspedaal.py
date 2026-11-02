"""Tests for the Gaspedaal.nl source: page parsing, occasion mapping, scope, dedup.

The fixture is a trimmed copy of the live /ford/mustang-mach-e page (2026-11-02):
four real occasions in the Next.js flight data, split over two push chunks.
"""
from pathlib import Path

import pytest

from mp_tesla import config, gaspedaal, model

FIXTURE = Path(__file__).parent / "fixtures" / "gaspedaal_mache.html"
MACHE = config.BRANDS["mach-e"]


@pytest.fixture(scope="module")
def page():
    return gaspedaal.parse_page(FIXTURE.read_text(encoding="utf-8"), "ford/mustang-mach-e")


def test_parse_page(page):
    assert len(page["occasions"]) == 4
    assert page["total"] == 383
    # Single-filter path slices only — no ?page= links, no nested paths.
    assert page["slices"] == ["2021", "2022", "rwd", "wit"]


def _by_id(page, ad_id):
    occ = next(o for o in page["occasions"] if o["advertentieId"] == ad_id)
    return gaspedaal.parse_occasion(occ, "Mustang", "mache")


def test_parse_occasion_fields(page):
    p = _by_id(page, 142308207)
    assert p["id"] == "gp-142308207"
    assert p["title"].startswith("Ford Mustang Mach-E Extended RWD 98 kWh")
    assert (p["year"], p["mileage_km"], p["price_eur"]) == (2021, 116427, 25900)
    assert p["power_hp"] == 294                     # 216 kW
    assert p["fuel"] == "Elektrisch" and p["transmission"] == "Automaat"
    assert p["body"] == "SUV of Terreinwagen"
    assert p["drivetrain_attr"] == "Achterwielaandrijving"
    assert p["condition"] == "USED"
    assert p["city"] == "Waalre" and p["seller_name"] == "Hedin Nissan Waalre"
    assert p["url"].startswith("https://cl.gaspedaal.nl/api/v1/clickouts/")


def test_parse_occasion_missing_power_and_new_stock(page):
    p = _by_id(page, 142564786)                     # motor is "$undefined"
    assert p["power_hp"] is None
    assert p["condition"] == "NEW"                  # 23 km
    assert p["seller_name"] == "Boerhof Groningen (Smidts Autogroep)"


def test_portal_fallback_when_no_preferred_portal(page):
    p = _by_id(page, 140555051)                     # only lease portals + AutoWereld
    assert p["url"] and p["portals"][0] == "AutoWereld"


def test_build_record_runs_brand_pipeline(page):
    rec = gaspedaal.record.build_gaspedaal_record(_by_id(page, 142308207), "2026-11-02", MACHE)
    assert rec["source"] == "gaspedaal"
    assert rec["model"] == "Mustang"
    assert rec["trim"] == "Extended Range"
    assert rec["drivetrain"] == "RWD"
    assert rec["fuel"] == "Electric"
    assert rec["premium_audio"] and rec["pano"]     # "Bang & Olufsen", "Panoramadak"
    assert rec["color"]
    awd = gaspedaal.record.build_gaspedaal_record(_by_id(page, 140555051), "2026-11-02", MACHE)
    assert (awd["trim"], awd["drivetrain"]) == ("Extended Range", "AWD")


def _occ(uitvoering, fuel, kw, model="Superb", body="STATIONWAGEN", gearbox="AUTOMATISCH",
         year=2022, km=80000, price=25000):
    return {
        "advertentieId": 1,
        "autogegevens": {
            "algemeen": {"merknaam": "Skoda", "modelnaam": model, "uitvoering": uitvoering,
                         "brandstofsoort": fuel, "transmissietype": gearbox,
                         "carrosserievorm": body, "kleur": "GRIJS"},
            "geschiedenis": {"bouwjaar": year, "kilometerstand": km},
            "motor": {"vermogenKw": kw},
        },
        "prijs": {"totaalInclusiefBtw": price},
        "aanbieder": {"aanbiedergegevens": {"plaatsnaam": "Utrecht"}},
        "portalen": [],
    }


@pytest.mark.parametrize("uitvoering, kw, expected", [
    ("Combi 1.4 TSI iV Business Edition", 160, "Hybride Elektrisch/Benzine"),
    ("Combi 1.4 TSI PHEV Sportline", 150, "Hybride Elektrisch/Benzine"),
    ("Combi 1.5 TSI e-TEC 150pk DSG", 110, "Benzine"),        # mild hybrid
    ("Combi 1.0 TSI mHEV Business", 81, "Benzine"),
    ("Combi Business Edition Plus", 160, "Hybride Elektrisch/Benzine"),  # 218 hp, no cue
])
def test_hybrid_split(uitvoering, kw, expected):
    assert gaspedaal.parse_occasion(_occ(uitvoering, "HYBRIDE", kw), "Superb", "skoda")["fuel"] == expected


def test_in_scope_applies_brand_filters():
    skoda = config.BRANDS["skoda"]
    ok = gaspedaal.parse_occasion(_occ("Combi 1.4 TSI iV", "HYBRIDE", 160), "Superb", "skoda")
    assert gaspedaal.in_scope(ok, skoda)
    for occ in (_occ("Combi 2.0 TDI", "DIESEL", 110),                    # diesel
                _occ("Combi 1.5 TSI", "BENZINE", 110, gearbox="HANDMATIG"),  # manual
                _occ("1.5 TSI Hatchback", "BENZINE", 110, body="HATCHBACK"),
                _occ("Combi 1.5 TSI", "BENZINE", 110, year=2017)):        # too old
        assert not gaspedaal.in_scope(gaspedaal.parse_occasion(occ, "Superb", "skoda"), skoda)


def test_skoda_driveline_default_and_4x4():
    fwd = gaspedaal.parse_occasion(_occ("Combi 1.5 TSI", "BENZINE", 110), "Superb", "skoda")
    awd = gaspedaal.parse_occasion(_occ("Combi 2.0 TSI 4x4 L&K", "BENZINE", 200), "Superb", "skoda")
    assert fwd["drivetrain_attr"] == "Voorwielaandrijving"
    assert awd["drivetrain_attr"] == "Vierwielaandrijving"


def test_enyaq_awd_only_power():
    rs = gaspedaal.parse_occasion(_occ("Coupé RS 82 kWh", "ELEKTRICITEIT", 220, model="Enyaq iV",
                                       body="SUV"), "Enyaq", "enyaq")      # 299 hp
    assert rs["drivetrain_attr"] == "Vierwielaandrijving"


def test_dedup_key():
    assert gaspedaal.dedup_key(2021, 116427, "Waalre") == (2021, 116427)
    # New stock (~10 km) needs the town: many dealers list "2026, 10 km".
    assert gaspedaal.dedup_key(2026, 10, " Groningen") == (2026, 10, "groningen")
    assert gaspedaal.dedup_key(None, 100, "x") is None


def test_seen_cars_exact_and_fuzzy():
    seen = gaspedaal.SeenCars([
        {"year": 2021, "mileage_km": 116427, "city": "Elders", "price_eur": 25900},
        {"year": 2026, "mileage_km": 10, "city": "Groningen", "price_eur": 52100},
    ])
    assert (2021, 116427, "Waalre", 1) in seen            # exact (year, km)
    assert (2021, 116700, "Waalre", 26300) in seen        # km +273, price +1.5%
    assert (2021, 117100, "Waalre", 25900) not in seen    # km +673
    assert (2021, 116427 + 100, "Waalre", 28000) not in seen  # price +8%
    assert (2026, 10, "groningen", 1) in seen             # new stock: town matters
    assert (2026, 10, "Zwolle", 52100) not in seen        # new stock is never fuzzy


def test_open_market_pools_gaspedaal_with_marktplaats():
    assert set(model.OPEN_MARKET_SOURCES) == {"marktplaats", "gaspedaal"}
