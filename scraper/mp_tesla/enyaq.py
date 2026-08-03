"""Skoda Enyaq variant / battery / equipment-line / body extraction.

The Enyaq's headline number is its battery pack, and after age and mileage it is
the biggest price driver — an iV 60 and an iV 80 of the same year are thousands
of euros apart. Two independent signals identify the variant:

  * **Power** — Marktplaats' structured `power_hp`. Primary signal, because it is
    a structured field rather than seller prose. It maps 1:1 onto the variant, but
    only *within a generation*: 204 hp is the pre-facelift iV 80 **and** the
    post-facelift 60, so the map has to be year-aware (see `variant_from_power`).
  * **Title text** — "iV 80", "Coupé 85 Sportline", "RS". Fallback, and anchored
    to the Enyaq naming context so that "80.000 km", "SOH 90%" or '21"' can never
    be read as a variant.

Measured over the 342-ad seed (2026-08-03) the two signals agree on 98.6% of the
listings carrying both; the disagreements are seller typos (e.g. a title saying
"iV 80" on a 179 hp car, which is definitively a 60), which is why power wins.

Body is derived here too: Marktplaats tags the Coupé and the regular SUV
identically ("SUV of Terreinwagen"), so the split only exists in the free text.
"""
from __future__ import annotations

import re

from . import config


def _norm(token: str) -> str:
    """'80 x' / '80X' -> '80x'."""
    return re.sub(r"\s+", "", token).lower()


def variant_from_power(power_hp, year) -> str | None:
    """Variant from the structured power figure, or None when unrecognised.

    Year-aware: the 2024 facelift reused 204 hp for the *60* (63 kWh), while
    pre-facelift 204 hp is the *80* (82 kWh). Getting this wrong would mislabel
    every facelift 60 as an 80.
    """
    if power_hp is None:
        return None
    for hp_values, year_from, year_to, variant in config.ENYAQ_POWER_VARIANTS:
        if power_hp not in hp_values:
            continue
        if year_from is not None and (year is None or year < year_from):
            continue
        if year_to is not None and (year is None or year > year_to):
            continue
        return variant
    return None


def variant_from_text(text: str) -> str | None:
    """Variant from the ad title, anchored to the Enyaq naming context."""
    if not text:
        return None
    if config.ENYAQ_RS_PATTERN.search(text):
        return "RS"
    m = config.ENYAQ_VARIANT_PATTERN.search(text)
    return _norm(m.group(1)) if m else None


def detect_variant(title: str, power_hp, year, drivetrain: str | None) -> str | None:
    """Best-effort Enyaq variant, power first then the title text.

    `drivetrain` separates the RWD/AWD pairs that share a power figure: the 85 and
    the 85x are both 286 hp, so only the driveline tells them apart.
    """
    variant = variant_from_power(power_hp, year) or variant_from_text(title)
    if variant is None:
        return None
    # 85/85x (and 80/80x) differ only in driveline; an AWD badge promotes the
    # base label to its 'x' twin. RS is AWD by definition, so it is left alone.
    if drivetrain == "AWD" and variant in config.ENYAQ_AWD_TWIN:
        variant = config.ENYAQ_AWD_TWIN[variant]
    return variant


def battery_kwh(variant: str | None, year, power_hp=None) -> float | None:
    """Usable (not gross) battery capacity in kWh for a variant.

    Usable is the honest number for a resale comparison — it is what the car can
    actually deliver. The one wrinkle is the 60: the facelift car carries a bigger
    pack than the original (59 vs 58 kWh usable). Power identifies it exactly (the
    facelift 60 is the 204 hp car, the original is 179/180 hp), so prefer that and
    only fall back to the build year when the ad doesn't state power.
    """
    if not variant:
        return None
    if variant == "60":
        if power_hp is not None:
            is_facelift = power_hp in config.ENYAQ_FACELIFT_60_HP
        else:
            is_facelift = year is not None and year >= config.ENYAQ_FACELIFT_YEAR
        if is_facelift:
            return config.ENYAQ_BATTERY_KWH_FACELIFT_60
    return config.ENYAQ_BATTERY_KWH.get(variant)


def detect_equipment_line(text: str) -> str | None:
    """Equipment/appearance line (Sportline, First Edition, …), first match wins.

    Only ~40% of ads name one, so this is genuinely sparse — the rest stay None
    and land in the regression's "unknown" bucket.
    """
    if not text:
        return None
    for label, patterns in config.ENYAQ_EQUIPMENT_LINES:
        for pat in patterns:
            if re.search(pat, text, re.I):
                return label
    return None


def detect_body(title: str, description: str) -> str:
    """'Coupé' or 'SUV'.

    Marktplaats reports "SUV of Terreinwagen" for both shapes, so this is the only
    way to split them. The title is checked first; the description is a fallback
    for the private sellers who only mention it in their prose.
    """
    if config.ENYAQ_COUPE_PATTERN.search(title or ""):
        return "Coupé"
    if config.ENYAQ_COUPE_PATTERN.search(description or ""):
        return "Coupé"
    return "SUV"
