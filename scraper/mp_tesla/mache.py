"""Ford Mustang Mach-E battery variant extraction.

The Mach-E's price hinges on its battery: Standard Range (~70 kWh usable) vs
Extended Range (~88-91 kWh), with the GT / Rally on top. Marktplaats has no
structured field for it, but sellers put it in the title ("RWD 75 kWh",
"Extended AWD 98 kWh", "GT"), so the title/description text is the primary
signal and the structured power figure only fills in the unambiguous bands.
"""
from __future__ import annotations

import re

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


_TITLE_AWD = re.compile(r"\bawd\b|4x4|vierwiel|dual\s*motor|all[\s-]*wheel", re.I)
_TITLE_RWD = re.compile(r"\brwd\b|achterwiel|rear[\s-]*wheel|single\s*motor", re.I)


def detect_drivetrain(title: str, structured: str | None, variant: str | None, power_hp) -> str | None:
    """'RWD' | 'AWD' | None. The seller's 'Aandrijving' field is often wrong for the
    Mach-E ("Voorwielaandrijving" on a car titled "Extended RWD"), so:
    1. the title wins when it names one driveline;
    2. GT / Rally are always AWD; an Extended Range at ~337–375 hp is the dual-motor
       AWD, at ~270–300 hp the single-motor RWD;
    3. otherwise the seller's field, except FWD, which no Mach-E has.
    The Standard Range RWD and AWD share 269 hp, so power can't split those."""
    awd, rwd = bool(_TITLE_AWD.search(title or "")), bool(_TITLE_RWD.search(title or ""))
    if awd != rwd:
        return "AWD" if awd else "RWD"
    if variant in ("GT", "Rally"):
        return "AWD"
    if variant == "Extended Range" and power_hp is not None:
        if 330 <= power_hp <= 380:
            return "AWD"
        if 270 <= power_hp <= 300:
            return "RWD"
    return structured if structured in ("RWD", "AWD") else None


def detect_equipment_line(title: str) -> str | None:
    """'First Edition' | 'Premium' | 'Select' from the title, or None (base car or
    not stated). Title only: dealer descriptions list option names too freely."""
    for line, pattern in config.MACHE_EQUIPMENT_LINES:
        if pattern.search(title or ""):
            return line
    return None
