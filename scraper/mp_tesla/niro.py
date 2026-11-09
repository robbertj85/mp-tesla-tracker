"""Kia Niro EV variant / battery / equipment-line extraction.

Marktplaats files both generations of the electric Niro under one model "Niro"
(11678), and the generation is what sets the price:

  * **e-Niro** (first gen, 2019–2022) — 39 kWh / 136 hp or 64 kWh / 204 hp.
  * **Niro EV** (second gen, from mid-2022) — 64.8 kWh / 204 hp only.

Both 64 kWh cars make the same 204 hp, so power only identifies the small pack.
The build year decides outside the changeover (≤ 2021 = e-Niro, ≥ 2023 =
Niro EV). For 2022 cars the title does: Kia sold the first gen as "e-Niro …
64 kWh" and the second as "Niro EV … 64.8 kWh", and sellers copy those names;
a 2022 car without either cue stays unknown.
The equipment line names (DynamicLine, ExecutiveLine, …) exist in both
generations, so they do not identify it.
"""
from __future__ import annotations

import re

from . import config


def detect_variant(title: str, power_hp, year) -> str | None:
    """'e-Niro 39' | 'e-Niro 64' | 'Niro EV', or None when unsure.

    Hybrids / PHEVs mis-filed as electric never get here: the brand's
    `title_exclude` drops them at search time."""
    title = title or ""
    # The 39 kWh pack only existed in the first generation.
    if power_hp in config.NIRO_SMALL_PACK_HP or config.NIRO_39_PATTERN.search(title):
        return "e-Niro 39"
    # Outside the 2022 changeover the build year settles it: sellers call a 2020
    # e-Niro a "Niro EV" often enough that the title can't overrule the year.
    if year is not None:
        if year <= config.NIRO_GEN1_LAST_YEAR:
            return "e-Niro 64"
        if year >= config.NIRO_GEN2_FIRST_YEAR:
            return "Niro EV"
    if config.NIRO_GEN2_PATTERN.search(title):
        return "Niro EV"
    if config.NIRO_GEN1_PATTERN.search(title):
        return "e-Niro 64"
    return None


def battery_kwh(variant: str | None) -> float | None:
    return config.NIRO_BATTERY_KWH.get(variant) if variant else None


def detect_equipment_line(title: str) -> str | None:
    """Equipment line from the title (ExecutiveLine, Edition Advanced, …), first match wins."""
    if not title:
        return None
    for label, patterns in config.NIRO_EQUIPMENT_LINES:
        if any(re.search(p, title, re.I) for p in patterns):
            return label
    return None
