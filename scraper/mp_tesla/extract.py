"""Free-text heuristics: derive trim, drivetrain, FSD/EAP, SoH, HW mentions, colour.

These parse the title + full description because Marktplaats has no structured
field for any of them. Everything is best-effort and returns None when unsure;
callers decide how to treat missing values.
"""
from __future__ import annotations

import re

from . import config


def _matches(text: str, patterns: list[str]) -> bool:
    return any(re.search(p, text, re.IGNORECASE) for p in patterns)


def detect_highland(text: str) -> bool:
    return _matches(text, config.HIGHLAND_PATTERNS) or _matches(text, config.GENERIC_REFRESH_PATTERNS)


def detect_juniper(text: str) -> bool:
    return _matches(text, config.JUNIPER_PATTERNS) or _matches(text, config.GENERIC_REFRESH_PATTERNS)


def detect_trim(text: str, allow_performance: bool = True) -> str | None:
    """Return the canonical BASE trim, or None (no refresh suffix).

    The refresh suffix (Highland/Juniper) is model-aware and added by the caller,
    since the same keyword means different things for Model 3 vs Model Y.
    `allow_performance=False` skips the Performance match — callers set this when
    the drivetrain/power rule out a Performance (it is always AWD + high power),
    since "performance" appears in plenty of ad prose unrelated to the trim.
    """
    for trim, patterns in config.TRIM_PATTERNS:
        if trim == "Performance" and not allow_performance:
            continue
        if _matches(text, patterns):
            return trim
    return None


def detect_drivetrain(text: str, structured: str | None = None) -> str | None:
    """RWD vs AWD. Prefer a structured driveTrain attribute when present."""
    if structured:
        s = structured.lower()
        if "achterwiel" in s or "rwd" in s or "rear" in s:
            return "RWD"
        if "vierwiel" in s or "awd" in s or "all" in s or "4wd" in s:
            return "AWD"
    for dt, patterns in config.DRIVETRAIN_PATTERNS.items():
        if _matches(text, patterns):
            return dt
    return None


def detect_autopilot_package(text: str) -> str:
    """Return 'fsd', 'eap', or 'basic'."""
    if _matches(text, config.FSD_PATTERNS):
        return "fsd"
    if _matches(text, config.EAP_PATTERNS):
        return "eap"
    return "basic"


def detect_fsd(text: str) -> bool:
    return detect_autopilot_package(text) == "fsd"


def detect_soh(text: str) -> float | None:
    """Find a battery State-of-Health percentage near a battery-health phrase.

    Returns a percentage in (50, 100] or None. We require the percentage to be
    within ~60 characters of a health keyword to avoid grabbing unrelated numbers
    (financing %, VAT, etc.).
    """
    low = text.lower()
    for ctx in config.SOH_CONTEXT_PATTERNS:
        for m in re.finditer(ctx, low, re.IGNORECASE):
            window = low[m.start(): m.end() + 60]
            pct = re.search(r"(\d{2,3}(?:[.,]\d)?)\s*%", window)
            if pct:
                val = float(pct.group(1).replace(",", "."))
                if 50.0 < val <= 100.0:
                    return val
    return None


def detect_hw_mention(text: str) -> str | None:
    """Return an explicitly-stated HW platform ('HW4'/'HW3'/'HW2.5') or None."""
    for hw, patterns in config.HW_EXPLICIT_PATTERNS.items():
        if _matches(text, patterns):
            return hw
    return None


# Dutch euro amounts: "€36.490", "€ 36.490,-", "€32.500", "€ 1.234,56".
_EURO_RE = re.compile(r"€\s?(\d{1,3}(?:[.\s]\d{3})+|\d{4,6})(?:,\d{1,2})?")


def _parse_amount(raw: str) -> int | None:
    digits = re.sub(r"[.\s]", "", raw)
    return int(digits) if digits.isdigit() else None


def extract_price_from_text(text: str) -> int | None:
    """Recover an asking price from free text when the headline price is bogus.

    Only returns an amount in [MIN_PRICE_EUR, MAX_PRICE_EUR]. Amounts preceded by a
    price keyword (vraagprijs/prijs/...) win; amounts preceded by a negative keyword
    (nieuwprijs/vanaf/lease/...) are ignored. With no keyword hit we only trust a
    single unambiguous amount — otherwise we return None rather than guess.
    """
    low = text.lower()
    keyword_hits: list[int] = []
    neutral: set[int] = set()
    for m in _EURO_RE.finditer(text):
        amt = _parse_amount(m.group(1))
        if amt is None or not (config.MIN_PRICE_EUR <= amt <= config.MAX_PRICE_EUR):
            continue
        before = low[max(0, m.start() - 16): m.start()]
        if any(neg in before for neg in config.PRICE_NEGATIVE_KEYWORDS):
            continue
        if any(pos in before for pos in config.PRICE_KEYWORDS):
            keyword_hits.append(amt)
        else:
            neutral.add(amt)
    if keyword_hits:
        return min(keyword_hits)
    return next(iter(neutral)) if len(neutral) == 1 else None


def normalise_color(raw: str | None) -> str | None:
    if not raw:
        return None
    low = raw.strip().lower()
    if low in config.COLOR_NORMALISE:
        return config.COLOR_NORMALISE[low]
    for key, val in config.COLOR_NORMALISE.items():
        if key in low:
            return val
    return raw.strip().title()


def extract_all(title: str, description: str, structured_drivetrain: str | None = None,
                structured_color: str | None = None) -> dict:
    """Run every text heuristic over title+description and return a flat dict."""
    text = f"{title}\n{description}"
    return {
        "trim": detect_trim(text),
        "is_highland": detect_highland(text),
        "is_juniper": detect_juniper(text),
        "drivetrain": detect_drivetrain(text, structured_drivetrain),
        "autopilot_package": detect_autopilot_package(text),
        "fsd": detect_fsd(text),
        "soh_percent": detect_soh(text),
        "hw_mention": detect_hw_mention(text),
        "color": normalise_color(structured_color),
    }
