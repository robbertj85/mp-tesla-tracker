"""Tests for the Kia Niro EV variant / battery / equipment-line extraction.

Titles are real shapes from the 2026-11-09 seed scrape (Marktplaats + Gaspedaal).
"""
import re

import pytest

from mp_tesla import config, gaspedaal, niro, record

NIRO = config.BRANDS["niro"]


@pytest.mark.parametrize("title, hp, year, expected", [
    ("Kia e-Niro ExecutiveLine 64 kWh | Trekhaak | Schuifdak", 204, 2020, "e-Niro 64"),
    ("Kia e-Niro DynamicPlusLine 39 kWh | schuif-/kanteldak | navi", 136, 2020, "e-Niro 39"),
    # The 39 kWh pack is first-gen only, whatever the seller calls it.
    ("Kia Niro EV 39 KwH Dynamic Plus Line | SOH 87,7%", None, 2021, "e-Niro 39"),
    ("Kia Niro EV DynamicLine 64.8 kWh | SOH 95,4% | Half leder", 204, 2023, "Niro EV"),
    ("Kia Niro EV Light Advanced 64.8 kWh", 204, 2024, "Niro EV"),
    # Outside 2022 the build year wins over a loose "Niro EV".
    ("Kia Niro EV ExecutiveLine 64 kWh", 204, 2020, "e-Niro 64"),
    ("Kia Niro Elektrisch 204pk Aut 2020 Zwart", 204, 2020, "e-Niro 64"),
    # 2022 is the changeover year: the title decides.
    ("Kia Niro 64,8 kWh 204pk Aut 2022 Zwart Elektrisch", 204, 2022, "Niro EV"),
    ("Kia Niro EV ComfortLine 64.8 kWh | Adaptieve Cruise Control", 204, 2022, "Niro EV"),
    ("Kia e-Niro Edition 64 kWh | SOH 100% | Adapt.Cruise", 204, 2022, "e-Niro 64"),
    ("Kia Niro Elektrisch 204pk", 204, 2022, None),
])
def test_detect_variant(title, hp, year, expected):
    assert niro.detect_variant(title, hp, year) == expected


@pytest.mark.parametrize("title, expected", [
    ("Kia e-Niro DynamicPlusLine 64 kWh | Trekhaak", "DynamicPlusLine"),
    ("Kia Niro EV 39 KwH Dynamic Plus Line | SOH 87,7%", "DynamicPlusLine"),
    ("Kia Niro EV DynamicLine 64.8 kWh SOH 98.2 %", "DynamicLine"),
    ("KIA E-NIRO EDITION 64 kWh (98% SOH) I AUTOMAAT I TREKHAAK", "Edition"),
    ("Kia Niro EV Edition Advanced 64.8 kWh | 98% SOH", "Edition Advanced"),
    ("Kia Niro EV Light Edition 64.8 kWh Acc | LM | Keyless", "Light Edition"),
    ("Kia Niro EV Plus Advanced 64.8 kWh Leder", "Plus Advanced"),
    ("Kia Niro EV Air 64.8 kWh EERSTE EIGENAAR", "Air"),
    ("Kia e-Niro 64kWh ExecutiveLine 100% SoH [ LEDER+PANO", "ExecutiveLine"),
    ("Kia Niro 64,8 kWh 204pk Aut 2022 Zwart Elektrisch", None),
])
def test_equipment_line(title, expected):
    assert niro.detect_equipment_line(title) == expected


def test_apply_spec_sets_battery():
    rec = record.apply_niro_spec({"title": "Kia e-Niro DynamicLine 39 kWh", "power_hp": 136,
                                  "year": 2021})
    assert (rec["trim"], rec["battery_kwh"], rec["equipment_line"]) == ("e-Niro 39", 39.2, "DynamicLine")


@pytest.mark.parametrize("title, excluded", [
    ("Kia Niro 1.6 GDi PHEV DynamicPlusLine - Adaptive Cruise", True),
    ("Kia Niro 1.6 GDi Hybrid ExecutiveLine", True),
    ("Kia Niro Plug-in Hybrid DynamicLine", True),
    ("Kia e-Niro ExecutiveLine 64 kWh WARMTEPOMP l JBL", False),
    ("Kia Niro EV Plus Advanced 64.8 kWh", False),
])
def test_title_exclude_drops_hybrids(title, excluded):
    assert bool(re.search(NIRO.title_exclude, title, re.I)) is excluded
    parsed = {"title": title, "year": 2021, "price_eur": 20000, "mileage_km": 50000,
              "fuel": "Elektrisch"}
    assert gaspedaal.in_scope(parsed, NIRO) is not excluded


@pytest.mark.parametrize("title, audio", [
    ("Kia e-Niro ExecutiveLine 64 kWh | Trekhaak", True),        # JBL standard
    ("Kia Niro EV Plus Advanced 64.8 kWh Leder", True),          # Harman Kardon standard
    ("Kia e-Niro DynamicPlusLine 64 kWh | Trekhaak", False),
])
def test_top_lines_imply_premium_audio(title, audio):
    rec = record.apply_niro_spec({"title": title, "power_hp": 204, "year": 2021,
                                  "premium_audio": False, "seat_memory": False})
    assert rec["premium_audio"] is audio and rec["seat_memory"] is audio
