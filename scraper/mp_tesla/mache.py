"""Ford Mustang Mach-E battery variant extraction.

The Mach-E's price hinges on its battery: Standard Range (~70 kWh usable) vs
Extended Range (~88-91 kWh), with the GT / Rally on top. Marktplaats has no
structured field for it, but sellers put it in the title ("RWD 75 kWh",
"Extended AWD 98 kWh", "GT"), so the title/description text is the primary
signal and the structured power figure only fills in the unambiguous bands.
"""
from __future__ import annotations

from . import config


def detect_variant(title: str, description: str, power_hp) -> str | None:
    """'Standard Range' | 'Extended Range' | 'GT' | 'Rally', or None when unsure.

    The title wins over the description: dealer descriptions often list the whole
    range ("verkrijgbaar met 75 of 98 kWh"), the title describes this car.
    """
    for text in (title or "", description or ""):
        for variant, pattern in config.MACHE_TEXT_VARIANTS:
            if pattern.search(text):
                return variant
    if power_hp is not None:
        for lo, hi, variant in config.MACHE_POWER_VARIANTS:
            if lo <= power_hp <= hi:
                return variant
    return None
