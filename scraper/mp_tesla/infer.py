"""Infer the Autopilot hardware platform (HW3 vs HW4) when not stated.

Marktplaats listings rarely state HW3/HW4 explicitly. When they do, we trust it
(high confidence). Otherwise we infer from model + build year + Highland status,
using the production-history thresholds in config.HW_INFERENCE. Every result
carries a confidence so the UI never over-trusts a guess.
"""
from __future__ import annotations

from . import config


def infer_hw_platform(model: str, year: int | None, is_highland: bool,
                      explicit_mention: str | None) -> dict:
    """Return {'value', 'source', 'confidence'}.

    source: 'explicit' (stated in the ad) or 'inferred' (derived).
    confidence: 'high' | 'medium' | 'low' | 'unknown'.
    """
    if explicit_mention:
        return {"value": explicit_mention, "source": "explicit", "confidence": "high"}

    rules = config.HW_INFERENCE.get(model)
    if not rules:
        return {"value": None, "source": "inferred", "confidence": "unknown"}

    if model == "Model 3":
        if is_highland:
            return {"value": "HW4", "source": "inferred", "confidence": "high"}
        # Pre-Highland Model 3 never shipped with HW4.
        conf = "high" if year and year <= 2023 else "medium"
        return {"value": rules["pre_highland_hw"], "source": "inferred", "confidence": conf}

    if model == "Model Y":
        if year is None:
            return {"value": None, "source": "inferred", "confidence": "unknown"}
        if year >= rules["hw4_from_year"]:
            return {"value": "HW4", "source": "inferred", "confidence": "medium"}
        if year <= rules["hw3_to_year"]:
            return {"value": "HW3", "source": "inferred", "confidence": "high"}
        # 2023 boundary year: most are HW3 but Berlin transitioned mid-year.
        return {"value": "HW3", "source": "inferred", "confidence": "low"}

    if model == "Model S":
        if year is None:
            return {"value": None, "source": "inferred", "confidence": "unknown"}
        # First band whose year ceiling covers the build year wins (see config).
        for year_to, value, confidence in rules["bands"]:
            if year <= year_to:
                return {"value": value, "source": "inferred", "confidence": confidence}
        return {"value": None, "source": "inferred", "confidence": "unknown"}

    return {"value": None, "source": "inferred", "confidence": "unknown"}


def tesla_premium_audio(model: str | None, trim: str | None, year: int | None) -> bool:
    """Whether a Tesla ships premium audio from the factory, from model/trim/year.

    Tesla doesn't sell audio as an option — it comes with the trim, so ads rarely
    mention it. Premium = subwoofer + amplified multi-speaker system:
      * Model 3 (pre-Highland and Highland): Long Range / Performance / Dual Motor.
        The SR / SR+ / RWD get the standard (no subwoofer) system.
      * Model Y pre-Juniper: every trim (13 speakers + subwoofer).
      * Model Y Juniper: Long Range / Performance / Dual Motor; the Juniper RWD and
        Standard are left to the ad text.
      * Model S: standard from the 2016 facelift; before that the "Ultra High
        Fidelity Sound" was an option, so earlier cars rely on the ad text.
    Returns False when unsure — callers OR this with the text/option detection.
    """
    t = trim or ""
    upper = any(k in t for k in ("Long Range", "Performance", "Dual Motor"))
    if model == "Model 3":
        return upper
    if model == "Model Y":
        return upper or ("Juniper" not in t and bool(t))
    if model == "Model S":
        return year is not None and year >= 2016
    return False
