"""Curated original (as-new) WLTP ranges for Tesla, by model, variant and year.

Tesla's used-inventory `ActualRange` is the car-specific (often degraded) figure.
To express it as a battery-condition %, we need the *original* WLTP for that exact
config. These are the published EU/NL WLTP figures at launch of each model-year —
they shift year to year (battery/efficiency updates) and a little with wheel size,
so treat them as the reference spec, not a per-VIN guarantee. Easy to edit: add or
correct a {year: km} breakpoint and the resolver carries it forward.

Variant keys are the canonical trims this scraper derives (see config.TRIM_PATTERNS):
"Long Range", "Performance", "RWD" (covers Standard Range Plus / RWD). Highland
(Model 3, 2024+) and Juniper (Model Y, 2025+) are encoded as later year breakpoints.
"""
from __future__ import annotations

# {model: {variant: {build_year: wltp_km}}}. A year picks the latest breakpoint
# whose year <= the car's build year (values carry forward to newer years).
ORIGINAL_WLTP_KM: dict[str, dict[str, dict[int, int]]] = {
    "Model 3": {
        # Long Range Dual Motor (AWD). 2024+ = Highland LR AWD.
        "Long Range":  {2019: 560, 2020: 580, 2021: 614, 2022: 626, 2023: 629, 2024: 629},
        # Performance (AWD). 2024+ = Highland Performance.
        "Performance": {2019: 530, 2020: 567, 2021: 547, 2022: 547, 2023: 547, 2024: 528},
        # Standard Range Plus / RWD (incl. LFP). 2024+ = Highland RWD.
        "RWD":         {2019: 409, 2020: 430, 2021: 448, 2022: 491, 2023: 491, 2024: 513},
    },
    "Model Y": {
        # Long Range Dual Motor (AWD). 2025+ = Juniper LR AWD.
        "Long Range":  {2020: 505, 2021: 505, 2022: 507, 2023: 533, 2024: 533, 2025: 568},
        "Performance": {2020: 480, 2021: 480, 2022: 480, 2023: 514, 2024: 514, 2025: 580},
        "RWD":         {2022: 455, 2023: 455, 2024: 455, 2025: 466},
    },
    "Model S": {
        # Long Range / AWD Dual Motor across the generations.
        "Long Range":  {2016: 451, 2017: 539, 2018: 539, 2019: 610, 2020: 610, 2021: 634, 2023: 634},
        "Performance": {2016: 507, 2017: 539, 2018: 539, 2019: 593, 2021: 600, 2023: 600},
    },
}


def _variant_key(model: str, trim: str | None, drivetrain: str | None) -> str | None:
    """Map a derived trim/drivetrain to a table variant key."""
    t = (trim or "").lower()
    if "performance" in t:
        return "Performance"
    if "long range" in t:
        return "Long Range"
    if "standard range" in t or t == "rwd" or (drivetrain or "").upper() == "RWD":
        return "RWD"
    if "dual motor" in t or "awd" in t:
        # Model S base is "AWD / Dual Motor"; on 3/Y treat as Long Range.
        return "Long Range" if model in ("Model 3", "Model Y") else "Long Range"
    return None


def original_wltp(model: str, trim: str | None, drivetrain: str | None,
                  year: int | None) -> int | None:
    """Return the original WLTP (km) for a config, or None when not in the table."""
    variants = ORIGINAL_WLTP_KM.get(model)
    if not variants or year is None:
        return None
    key = _variant_key(model, trim, drivetrain)
    breaks = variants.get(key) if key else None
    if not breaks:
        return None
    chosen = None
    for y in sorted(breaks):
        if y <= year:
            chosen = breaks[y]
    # Build year older than the first breakpoint: fall back to the earliest figure.
    return chosen if chosen is not None else breaks[min(breaks)]
