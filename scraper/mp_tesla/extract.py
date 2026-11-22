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


# A whole number, never the tail of a longer one ("91,55" must not yield "55").
_SOH_NUM = r"(?<![\d.,])(\d{2,3}(?:[.,]\d+)?)"


def _soh_value(raw: str) -> float | None:
    val = float(raw.replace(",", "."))
    return val if 50.0 < val <= 100.0 else None


def detect_soh(text: str) -> float | None:
    """Find a battery State-of-Health percentage near a battery-health phrase.

    Returns a percentage in (50, 100] or None. We require the percentage to be
    within ~60 characters of a health keyword to avoid grabbing unrelated numbers
    (financing %, VAT, etc.). Handles the forms dealers use in titles:
    "SOH 93,1%", "SOH93%", "{SoH-88%}", "87% SOH", "(91%SOH)", and a bare
    "SOH 92" where a long title got cut off before the % sign.
    """
    low = text.lower()
    # A labelled value, % optional: "SOH: 93.12" (MOBA certificate), "soh=90,1%".
    for m in re.finditer(r"\bsoh(?![a-z])\s*(?:waarde|score)?\s*[:=]\s*(\d{2,3}(?:[.,]\d+)?)(?![\d.,])", low):
        if (val := _soh_value(m.group(1))) is not None:
            return val
    for ctx in config.SOH_CONTEXT_PATTERNS:
        for m in re.finditer(ctx, low):
            window = low[m.end(): m.end() + 60]
            pct = re.search(_SOH_NUM + r"\s*%", window)
            # Skip a charge level in between ("batterijniveau bij de meting: 55.6%").
            if pct and re.search(r"niveau|\bsoc\b|lading", window[:pct.start()]):
                pct = None
            if pct and (val := _soh_value(pct.group(1))) is not None:
                return val
            # Bare number right after the keyword, with nothing after it but a
            # separator or the end of the text ("| SOH 92" at a cut-off title end).
            bare = re.match(r"[\s:=-]{0,3}(\d{2,3}(?:[.,]\d+)?)(?![\d.,%]|\s*\w)", window)
            if bare and (val := _soh_value(bare.group(1))) is not None:
                return val
    # Percentage first, keyword after: "87% SOH", "(91%SOH)".
    after = "|".join(config.SOH_CONTEXT_PATTERNS)
    for m in re.finditer(_SOH_NUM + r"\s*%\s*-?\s*(?:" + after + ")", low):
        if (val := _soh_value(m.group(1))) is not None:
            return val
    return None


def _mentions_option(low: str, patterns: list[str], exclude: tuple) -> bool:
    """True on the first positive (non-negated, non-excluded) pattern match."""
    for m in re.finditer("|".join(patterns), low):
        before = low[max(0, m.start() - 20):m.start()]
        around = low[max(0, m.start() - 20):m.end() + 25]
        if any(neg in before for neg in config.OPTION_NEGATIVE):
            continue
        if any(w in around for w in (*config.OPTION_EXCLUDE_COMMON, *exclude)):
            continue
        return True
    return False


def detect_option(key: str, text: str, mp_options: list[str] | None = None) -> bool:
    """Whether equipment option `key` (see config.EQUIPMENT_OPTIONS) is present.

    Marktplaats' structured "Opties" checkbox list wins when it names the option;
    otherwise we fall back to a positive, non-negated mention in the ad text.
    """
    spec = config.EQUIPMENT_OPTIONS[key]
    if mp_options and any(o in mp_options for o in spec["mp_options"]):
        return True
    return _mentions_option(text.lower(), spec["patterns"], spec["exclude"])


def detect_options(text: str, mp_options: list[str] | None = None) -> dict[str, bool]:
    """Every equipment flag at once: {"tow_hitch": bool, "acc": bool, ...}."""
    return {key: detect_option(key, text, mp_options) for key in config.EQUIPMENT_OPTIONS}


def detect_tow_hitch(text: str) -> bool:
    """True when the car has a tow bar fitted (trekhaak / tow bar / hitch).

    Skips negated mentions ("geen/zonder/niet ... trekhaak") and prep-only wording
    ("trekhaak voorbereiding", "optioneel"), so "Met trekhaak" / "Afneembare
    trekhaak" / Tesla's "Trekhaak" option all count, but "geen trekhaak" does not.
    """
    return detect_option("tow_hitch", text)


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


# "Kilometerstand: 119.789 km", "Tellerstand 111.368", "km-stand van 119.266km".
# A keyword is required: bare "610 km" is usually range (WLTP) or a warranty limit.
_MILEAGE_RE = re.compile(
    # Only filler between keyword and number ("(NAP):", "van", "ca."), so
    # "Kilometerstand: ?, bouwjaar 2021" doesn't read the year.
    r"(?:kilometerstand|tellerstand|km[- ]?stand)\b\s*(?:\([^)]{0,12}\)\s*)?(?:[:=\-–]\s*)?"
    r"(?:(?:van|is|ca\.?|circa|ongeveer|slechts)\s+)?"
    r"(\d{1,3}(?:[.\s]\d{3})+|\d{1,6})(?![\d.,]*\s*%)",
    re.IGNORECASE,
)
MAX_MILEAGE_KM = 600_000


def extract_mileage_from_text(text: str) -> int | None:
    """The odometer reading stated next to a mileage keyword, or None.

    For ads where Marktplaats has no structured mileage. The first plausible
    keyword hit wins (the spec block usually comes before the prose)."""
    for m in _MILEAGE_RE.finditer(text):
        km = _parse_amount(m.group(1))
        if km is not None and km <= MAX_MILEAGE_KM:
            return km
    return None


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
