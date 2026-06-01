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

    return {"value": None, "source": "inferred", "confidence": "unknown"}
