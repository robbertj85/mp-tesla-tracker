"""Curated original (as-new) WLTP ranges for Tesla, by model, variant and year.

Tesla's used-inventory `ActualRange` is the car-specific (often degraded) figure.
To express it as a battery-condition %, we need the *original* WLTP for that exact
config. These are the published EU/NL WLTP figures by model year, researched mainly
from EV Database (ev-database.org), cross-checked with Wikipedia / EU press
(June 2026). They are the headline WLTP Tesla advertised for the common wheel;
larger wheels lower real range a few %, so treat the % as an estimate, not a
per-VIN guarantee. Easy to edit: add/correct a {year: km} breakpoint and the
resolver carries it forward to newer years.

Variant keys are the canonical trims this scraper derives (see config.TRIM_PATTERNS):
"Long Range" (Dual Motor AWD), "Long Range RWD" (Highland/Juniper single-motor LR),
"Performance", "RWD" (covers Standard Range Plus / RWD). The Highland (Model 3) and
Juniper (Model Y) refreshes are encoded as later year breakpoints; a "(Highland)" /
"(Juniper)" trim suffix also bumps the lookup year so a late-2023/early-2025 refresh
car is rated against the new figure.
"""
from __future__ import annotations

# {model: {variant: {build_year: wltp_km}}}. A year picks the latest breakpoint
# whose year <= the car's build year (values carry forward to newer years).
ORIGINAL_WLTP_KM: dict[str, dict[str, dict[int, int]]] = {
    "Model 3": {
        # Long Range Dual Motor (AWD): 560→580→614 pre-Highland; 629 Highland (2024+).
        "Long Range":     {2019: 560, 2020: 580, 2021: 614, 2024: 629},
        # Long Range RWD — Highland single-motor LR (added EU Oct 2024), the longest range.
        "Long Range RWD": {2024: 702},
        # Performance (AWD): 530→567, re-rated 547 (2022); 528 Highland (2024+).
        "Performance":    {2019: 530, 2020: 567, 2022: 547, 2024: 528},
        # Standard Range Plus / RWD (NCA→LFP): 409→448→491; 513 Highland RWD (2024+).
        "RWD":            {2019: 409, 2020: 448, 2022: 491, 2024: 513},
    },
    "Model Y": {
        # Long Range Dual Motor (AWD): 505 (2021) → 533 (2022+); 568 Juniper (2025+).
        "Long Range":     {2021: 505, 2022: 533, 2025: 568},
        # Long Range RWD: added Feb 2024 (600), Juniper 622 (2025+).
        "Long Range RWD": {2024: 600, 2025: 622},
        # Performance (AWD): 480 (2021) → 514 (2022+); 580 Juniper (2025+).
        "Performance":    {2021: 480, 2022: 514, 2025: 580},
        # RWD (LFP, EU from late 2022): 455; 500 Juniper (2025+).
        "RWD":            {2022: 455, 2025: 500},
    },
    "Model S": {
        # Long Range / AWD Dual Motor across generations: Raven 610 (2019) → LR Plus
        # 652 (2020-2021) → refresh Dual Motor 634 (2023-2025) → MY26 refresh 744 (2025+).
        "Long Range":  {2019: 610, 2020: 652, 2023: 634, 2025: 744},
        # Performance / Plaid: Raven 593→639; Plaid refresh 600 (2022+); MY26 Plaid 611.
        "Performance": {2019: 593, 2020: 639, 2022: 600, 2025: 611},
    },
}


def _variant_key(model: str, trim: str | None, drivetrain: str | None,
                 variants: dict) -> str | None:
    """Map a derived trim/drivetrain to a table variant key."""
    t = (trim or "").lower()
    drv = (drivetrain or "").upper()
    if "performance" in t:
        return "Performance"
    if "long range" in t:
        if drv == "RWD" and "Long Range RWD" in variants:
            return "Long Range RWD"
        return "Long Range"
    if "standard range" in t or t == "rwd" or drv == "RWD":
        return "RWD"
    if "dual motor" in t or "awd" in t:
        # Model S base is "AWD / Dual Motor"; on 3/Y treat as Long Range.
        return "Long Range"
    return None


def original_wltp(model: str, trim: str | None, drivetrain: str | None,
                  year: int | None) -> int | None:
    """Return the original WLTP (km) for a config, or None when not in the table."""
    variants = ORIGINAL_WLTP_KM.get(model)
    if not variants or year is None:
        return None
    # A refresh trim bumps the lookup year so boundary-year cars get the new figure.
    eff = year
    t = (trim or "").lower()
    if "highland" in t and eff < 2024:
        eff = 2024
    if "juniper" in t and eff < 2025:
        eff = 2025
    key = _variant_key(model, trim, drivetrain, variants)
    breaks = variants.get(key) if key else None
    if not breaks:
        return None
    chosen = None
    for y in sorted(breaks):
        if y <= eff:
            chosen = breaks[y]
    # Build year older than the first breakpoint: fall back to the earliest figure.
    return chosen if chosen is not None else breaks[min(breaks)]
