"""Tests for the Skoda Enyaq variant / battery / equipment-line / body extraction.

The cases below are real title shapes from the 2026-08-03 seed scrape, including
the ones that made the naive readings wrong (facelift power reuse, mileage digits
that look like variant numbers, seller-entered drivetrain errors).
"""
import pytest

from mp_tesla import config, enyaq, record

BRAND = config.BRANDS["enyaq"]


# --- variant from power (the primary signal) --------------------------------------

@pytest.mark.parametrize("hp, year, expected", [
    (148, 2021, "50"),
    (179, 2021, "60"),
    (180, 2022, "60"),
    (204, 2022, "80"),      # pre-facelift 204 hp is the 80 (82 kWh)
    (204, 2026, "60"),      # ...but post-facelift the SAME 204 hp is the 60 (63 kWh)
    (265, 2022, "80x"),
    (286, 2025, "85"),
    (299, 2023, "RS"),
    (300, 2024, "RS"),      # sellers round the pre-facelift RS's 299 hp
    (340, 2026, "RS"),
    (95, 2021, None),       # nonsense figure -> no guess
    (None, 2021, None),
])
def test_variant_from_power(hp, year, expected):
    assert enyaq.variant_from_power(hp, year) == expected


def test_facelift_boundary_is_the_whole_point_of_the_year_check():
    """204 hp flips meaning across the facelift; getting it wrong mislabels every
    facelift 60 as an 80 and inflates its battery by 18 kWh."""
    assert enyaq.variant_from_power(204, config.ENYAQ_FACELIFT_YEAR - 1) == "80"
    assert enyaq.variant_from_power(204, config.ENYAQ_FACELIFT_YEAR) == "60"


# --- variant from the title (fallback) --------------------------------------------

@pytest.mark.parametrize("title, expected", [
    ("Skoda Enyaq iV 80 |SOH 90%|Stuurverwarming|ACC |trekhaak", "80"),
    ("Skoda Enyaq iV 60 SOH 91.38% | CAMERA | CARPLAY", "60"),
    ("Skoda Enyaq 85 Business Edition | Trekhaak Wegklapbaar | 21\"", "85"),
    ("Skoda ENYAQ Coupé iV 80 RS | Full options | Racing Blue", "RS"),
    ("Skoda Enyaq 50 - over 2 jaar pas weer APK en onderhoud!", "50"),
    ("Skoda Enyaq Coupé 85X Sportline", "85x"),
    ("Skoda Enyaq", None),
])
def test_variant_from_text(title, expected):
    assert enyaq.variant_from_text(title) == expected


@pytest.mark.parametrize("title", [
    "Skoda Enyaq iV 60 met 80.000 km op de teller",   # mileage, not a variant
    "Skoda Enyaq iV 60 | SOH 85% | 21\" velgen",       # SoH %, not a variant
    "Skoda Enyaq iV 60 Two-Tone 400 km actieradius",   # range, not a variant
])
def test_variant_text_is_anchored_and_ignores_stray_numbers(title):
    """The token has to follow Enyaq/Coupé/iV, so nearby numbers can't hijack it."""
    assert enyaq.variant_from_text(title) == "60"


# --- combining the two signals ----------------------------------------------------

def test_power_wins_over_a_contradicting_title():
    # Real ad: titled "iV 80" but the structured power says 179 hp, which is a 60.
    assert enyaq.detect_variant("Skoda Enyaq iV 80 First Edition", 179, 2021, "RWD") == "60"


def test_title_is_used_when_power_is_missing():
    assert enyaq.detect_variant("Skoda Enyaq iV 80 Sportline", None, 2022, "RWD") == "80"


def test_awd_promotes_only_the_pair_that_shares_a_power_figure():
    # 85 and 85x are both 286 hp -> the driveline is the only separator.
    assert enyaq.detect_variant("Skoda Enyaq 85", 286, 2025, "AWD") == "85x"
    assert enyaq.detect_variant("Skoda Enyaq 85", 286, 2025, "RWD") == "85"
    # 80 (204 hp) and 80x (265 hp) are already separated by power, so a wrong AWD
    # attribute on a 204 hp ad must NOT turn it into an 80x.
    assert enyaq.detect_variant("Skoda Enyaq iV 80 First Edition", 204, 2021, "AWD") == "80"


# --- battery ----------------------------------------------------------------------

@pytest.mark.parametrize("variant, year, hp, expected", [
    ("50", 2021, 148, 52.0),
    ("60", 2021, 179, 58.0),
    ("60", 2026, 204, 59.0),   # facelift 60 has the bigger pack
    ("80", 2022, 204, 77.0),
    ("85", 2025, 286, 77.0),
    ("RS", 2023, 299, 77.0),
    (None, 2022, 204, None),
])
def test_battery_kwh(variant, year, hp, expected):
    assert enyaq.battery_kwh(variant, year, hp) == expected


def test_battery_prefers_power_over_year_for_the_60():
    """A 179 hp car first registered in 2024 is leftover pre-facelift stock, so it
    still has the 58 kWh pack even though its year is on the facelift side."""
    assert enyaq.battery_kwh("60", 2024, 179) == 58.0
    # With no power figure at all we can only go on the year.
    assert enyaq.battery_kwh("60", 2026, None) == 59.0


# --- equipment line + body --------------------------------------------------------

@pytest.mark.parametrize("text, expected", [
    ("Skoda Enyaq iV 60 Sportline 180pk", "Sportline"),
    ("Skoda Enyaq iV 60 First Edition SOH 93,9%", "First Edition"),
    ("Skoda Enyaq 85 Business Edition", "Business Edition"),
    ("Skoda Enyaq iV 80 Laurin & Klement", "Laurin & Klement"),
    ("Skoda Enyaq iV 80 | trekhaak | camera", None),
])
def test_detect_equipment_line(text, expected):
    assert enyaq.detect_equipment_line(text) == expected


def test_detect_body_splits_coupe_from_suv():
    # Marktplaats reports "SUV of Terreinwagen" for both, so the text is all we have.
    assert enyaq.detect_body("Skoda Enyaq Coupé 85 Sportline", "") == "Coupé"
    assert enyaq.detect_body("Skoda Enyaq Coupe 85", "") == "Coupé"
    assert enyaq.detect_body("Skoda Enyaq iV 80", "") == "SUV"
    # Private sellers sometimes only say it in the description.
    assert enyaq.detect_body("Skoda Enyaq 60 Elektromotor 180pk",
                             "Te koop: mijn nette Škoda Enyaq Coupé.") == "Coupé"


# --- wiring -----------------------------------------------------------------------

def test_derive_enyaq_spec_fills_every_field():
    spec = record.derive_enyaq_spec(
        "Skoda Enyaq Coupé iV 80 Sportline", "Nette auto.", 2022, 204, "RWD")
    assert spec == {"trim": "80", "battery_kwh": 77.0,
                    "equipment_line": "Sportline", "body": "Coupé"}


def test_enyaq_brand_uses_its_own_feature_spec():
    spec = config.FEATURE_SPECS[BRAND.pipeline]
    assert BRAND.pipeline == "enyaq"
    assert "battery_kwh" in spec["numeric"]
    assert {"trim", "equipment_line", "body"} <= set(spec["categorical"])
    # Constant across the whole tracker, so they carry no signal.
    assert "fuel" not in spec["categorical"]
    assert "transmission" not in spec["categorical"]
