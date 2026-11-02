"""Volkswagen ID.4 variant / battery / equipment-line extraction.

Like its MEB sibling the Enyaq, the ID.4's price hinges on the battery: the Pure
(52 kWh usable) vs the Pro (77 kWh), with the all-wheel-drive Pro 4MOTION and the
GTX on top. Two signals identify the variant:

  * **Power** — Marktplaats' structured `power_hp`, primary because it is not
    seller prose. 286 hp is both the 2024+ Pro and Pro 4MOTION, so the driveline
    (or a "4MOTION" in the title) splits that pair.
  * **Title text** — "Pro 77 kWh", "Pure 52 kWh", "GTX". Fallback; the title is
    used rather than the description because dealer prose often lists the whole
    range ("leverbaar met 52 of 77 kWh").
"""
from __future__ import annotations

import re

from . import config


def variant_from_power(power_hp) -> str | None:
    if power_hp is None:
        return None
    for hp_values, variant in config.ID4_POWER_VARIANTS:
        if power_hp in hp_values:
            return variant
    return None


def variant_from_text(title: str) -> str | None:
    if not title:
        return None
    if config.ID4_GTX_PATTERN.search(title):
        return "GTX"
    if config.ID4_PURE_PATTERN.search(title):
        return "Pure"
    if config.ID4_PRO_PATTERN.search(title) or config.ID4_4MOTION_PATTERN.search(title):
        return "Pro"
    return None


def detect_variant(title: str, power_hp, drivetrain: str | None) -> str | None:
    """'Pure' | 'Pro' | 'Pro 4MOTION' | 'GTX', or None when unsure.

    A Pro is promoted to Pro 4MOTION when the title says 4MOTION, or when the car
    is the 286 hp version (shared by RWD and AWD) and the driveline is AWD. The
    174/204 hp Pro only ever came with RWD, so an AWD attribute there is a seller
    error and is ignored.
    """
    variant = variant_from_power(power_hp) or variant_from_text(title)
    if variant == "Pro" and (
        config.ID4_4MOTION_PATTERN.search(title or "")
        or (power_hp in (None, 286) and drivetrain == "AWD")
    ):
        variant = "Pro 4MOTION"
    return variant


def battery_kwh(variant: str | None) -> float | None:
    return config.ID4_BATTERY_KWH.get(variant) if variant else None


def detect_equipment_line(title: str) -> str | None:
    """Equipment line from the title (1st Max, Style, Business, …), first match wins."""
    if not title:
        return None
    for label, patterns in config.ID4_EQUIPMENT_LINES:
        if any(re.search(p, title, re.I) for p in patterns):
            return label
    return None
