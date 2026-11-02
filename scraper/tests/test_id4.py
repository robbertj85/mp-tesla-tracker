"""Tests for the Volkswagen ID.4 variant / battery / equipment-line extraction.

Titles are real shapes from the 2026-11-02 seed scrape.
"""
import pytest

from mp_tesla import id4, record


@pytest.mark.parametrize("title, hp, drivetrain, expected", [
    ("Volkswagen ID.4 Pure 52 kWh 170 PK| Dealeronderhouden", 170, "RWD", "Pure"),
    ("Volkswagen ID.4 City 52 kWh 148pk | SoH 91% | Trekhaak", 148, "RWD", "Pure"),
    ("Volkswagen ID.4 Pro 77 kWh 174 PK| Origineel Nederlands", 174, "RWD", "Pro"),
    ("Volkswagen ID.4 Pro Performance 77kWh 204PK l 90.19% SOH", 204, "RWD", "Pro"),
    ("Volkswagen ID.4 Pro 77 kWh 286pk | LED Matrix IQ | SOH 98%", 286, "RWD", "Pro"),
    # 286 hp is shared by the 2024+ Pro and Pro 4MOTION: the driveline decides.
    ("Volkswagen ID.4 Pro 77 kWh 286pk", 286, "AWD", "Pro 4MOTION"),
    ("Volkswagen ID.4 Pro 4MOTION 77 kWh", 265, "AWD", "Pro 4MOTION"),
    ("Volkswagen ID.4 GTX 4Motion 77 kWh | SOH 94% | IQ Light", 299, "AWD", "GTX"),
    ("Volkswagen ID.4 GTX 77 kWh", None, None, "GTX"),
    # A 204 hp Pro only exists as RWD; an AWD attribute is a seller error.
    ("Volkswagen ID.4 Pro 77 kWh 204 PK", 204, "AWD", "Pro"),
    # No power stated: the title's pack decides.
    ("Volkswagen ID.4 First 77 kWh", None, None, "Pro"),
    ("Volkswagen ID.4 Limited Edition 52 kWh | SOH 100%", None, None, "Pure"),
    ("Volkswagen ID.4", None, None, None),
])
def test_detect_variant(title, hp, drivetrain, expected):
    assert id4.detect_variant(title, hp, drivetrain) == expected


@pytest.mark.parametrize("title, expected", [
    ("VOLKSWAGEN ID.4 FIRST MAX 77KWH | SOH 91% | PANO | HUD", "1st Max"),
    ("Volkswagen Id.4 77kWh 204pk 1ST MAX [ PANO+21INCH", "1st Max"),
    ("VW ID.4 77kWh 1st Edition Geel 1e Eig. Trekhaak", "1st Edition"),
    ("Volkswagen ID.4 Max 77 kWh // PANORAMADAK // HEAD UP", "Max"),
    ("Volkswagen ID.4 Pro 77 kWh Style Plus Memory Camera", "Style"),
    ("Volkswagen ID.4 286pk Pro Limited Edition 77 kWh", "Limited Edition"),
    ("Volkswagen ID.4 Pro 77 kWh | Trekhaak | Warmtepomp", None),
])
def test_equipment_line(title, expected):
    assert id4.detect_equipment_line(title) == expected


def test_apply_spec_sets_battery():
    rec = record.apply_id4_spec({"title": "Volkswagen ID.4 Pure 52 kWh", "power_hp": 170,
                                 "drivetrain": "RWD"})
    assert (rec["trim"], rec["battery_kwh"]) == ("Pure", 52.0)
