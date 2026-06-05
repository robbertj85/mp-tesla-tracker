"""Central configuration: brand registry, search params, and extraction heuristics.

All values here were validated against the live Marktplaats endpoints on
2026-06-01 (see README "How the scraping works"). Keep tunable knobs here so the
rest of the package stays declarative.

The scraper tracks multiple brands (Tesla, Skoda). Everything brand-specific lives
in the `BRANDS` registry below; the rest of the package is brand-generic and takes
a `Brand` as input. Tesla and Skoda are stored, modelled and exported separately —
they are never mixed.
"""
from __future__ import annotations

from dataclasses import dataclass

# --- Marktplaats search endpoint -------------------------------------------------
# The site's own internal JSON API. A plain GET with a realistic User-Agent works
# server-side (no browser/cookies needed); AWS WAF only rarely challenges.
SEARCH_URL = "https://www.marktplaats.nl/lrp/api/search"
BASE_URL = "https://www.marktplaats.nl"

L1_CATEGORY_ID = 91      # Auto's (shared by all car brands)
POSTCODE = "3051VM"      # makes location.distanceMeters relative to Rotterdam 3051
PAGE_SIZE = 30           # site default; keep modest to look human
MAX_PAGES = 40           # safety cap (~1200 listings/brand)
SORT_BY = "SORT_INDEX"   # default relevance


# =================================================================================
# Brand registry
# =================================================================================
# attributeValueIds passed via `attributesById[]`. Multiple values of the SAME
# attribute (e.g. two models, two fuels) are OR'd; values of DIFFERENT attributes
# are AND'd. So [Octavia, Superb, Benzine, PHEV, Automaat] means
# (Octavia OR Superb) AND (Benzine OR PHEV) AND Automaat. All IDs verified live.

@dataclass(frozen=True)
class Brand:
    key: str                       # "tesla" | "skoda" (used for paths/routes)
    label: str                     # "Tesla" | "Skoda"
    l2_category_id: int            # Marktplaats brand sub-category of Auto's (91)
    models: dict                   # canonical model name -> model attributeValueId
    year_from: int                 # constructionYear floor
    year_to: int | None            # constructionYear ceiling (None = unbounded)
    price_cents_to: int            # PriceCents ceiling for the search
    min_price_eur: int             # reject headline prices below this (lease/teaser)
    pipeline: str                  # "tesla" | "skoda" — selects extraction/features
    source_query: str              # human-readable description shown in the UI
    brand_attr_id: int | None = None   # brand facet id (Tesla); None when l2 suffices
    mileage_to: int | None = None  # mileage (km) ceiling for the search (None = unbounded)
    fuel_ids: tuple = ()           # fuel attributeValueIds to filter on (Skoda)
    transmission_ids: tuple = ()   # transmission attributeValueIds to filter on
    body_ids: tuple = ()           # body/carrosserie attributeValueIds to filter on
    allowed_fuels: tuple = ()      # fuel labels accepted by the post-fetch guard
    allowed_transmissions: tuple = ()  # transmission labels accepted by the guard
    allowed_bodies: tuple = ()     # body labels accepted by the post-fetch guard

    @property
    def search_attr_ids(self) -> list[int]:
        """All `attributesById[]` values for this brand's search query."""
        ids: list[int] = []
        if self.brand_attr_id is not None:
            ids.append(self.brand_attr_id)
        ids.extend(self.models.values())
        ids.extend(self.fuel_ids)
        ids.extend(self.transmission_ids)
        ids.extend(self.body_ids)
        return ids


BRANDS: dict[str, Brand] = {
    "tesla": Brand(
        key="tesla",
        label="Tesla",
        l2_category_id=2830,
        brand_attr_id=10882,
        models={"Model 3": 11736, "Model Y": 13853},
        year_from=2017,
        year_to=None,
        price_cents_to=4_500_000,
        min_price_eur=5000,
        pipeline="tesla",
        source_query="auto-s/tesla | Model 3 + Model Y | constructionYear>=2017 | price<=45000",
    ),
    "skoda": Brand(
        key="skoda",
        label="Skoda",
        l2_category_id=151,
        models={"Octavia": 1185, "Superb": 1186},
        # Benzine (petrol) + Hybride Elektrisch/Benzine (PHEV); diesel/EV excluded.
        fuel_ids=(473, 13838),
        # Automaat only — manuals are skipped.
        transmission_ids=(534,),
        # Stationwagon (Combi) only — sedans/hatchbacks excluded.
        body_ids=(484,),
        allowed_fuels=("Benzine", "Hybride Elektrisch/Benzine"),
        allowed_transmissions=("Automaat",),
        allowed_bodies=("Stationwagon",),
        year_from=2019,
        year_to=None,
        price_cents_to=6_000_000,
        min_price_eur=3500,
        pipeline="skoda",
        source_query="auto-s/skoda | Octavia + Superb Combi | benzine + PHEV | automaat | constructionYear>=2019",
    ),
    # A second-hand-market view for selling an older Octavia: every Octavia from
    # build years 2006–2014, ALL body styles (hatchback + Combi) and BOTH gearboxes
    # (the dashboard's transmission filter splits automatic vs manual). No fuel
    # filter either — diesels dominate this era. Reuses the Skoda extraction
    # pipeline; only the search scope and (lack of) guards differ.
    "octavia": Brand(
        key="octavia",
        label="Skoda Octavia",
        l2_category_id=151,
        models={"Octavia": 1185},
        # No fuel / transmission / body filters: capture the whole market so the
        # auto-vs-manual split (and diesel/petrol mix) is visible in the dashboard.
        year_from=2006,
        year_to=2014,
        price_cents_to=2_500_000,   # <= €25,000 (a clean late one tops out here)
        min_price_eur=500,          # old Octavias are cheap; only drop teaser junk
        pipeline="skoda",
        source_query="auto-s/skoda | Octavia (alle uitvoeringen) | constructionYear 2006–2014",
    ),
    # Tesla Model S resale view from build year 2013 on, mileage capped at 250,000 km.
    # Reuses the Tesla extraction pipeline; the Autopilot platform (HW1/2/2.5/3/4) is
    # inferred from build year per config.HW_INFERENCE["Model S"] when the ad is silent.
    "model-s": Brand(
        key="model-s",
        label="Tesla Model S",
        l2_category_id=2830,
        brand_attr_id=10882,
        models={"Model S": 11735},
        mileage_to=250_000,
        year_from=2013,
        year_to=None,
        price_cents_to=10_000_000,  # <= €100,000 (covers the odd refreshed Plaid)
        min_price_eur=5000,
        pipeline="tesla",
        source_query="auto-s/tesla | Model S | constructionYear>=2013 | km<=250000 | price<=100000",
    ),
}


# Per-pipeline regression features. The frame builder (model.py) and JS estimator
# (predict.ts) both read these, so the two brands train on the right columns.
FEATURE_SPECS: dict[str, dict] = {
    "tesla": {
        "numeric": ["age", "mileage_km", "power_hp", "range_km"],
        "categorical": ["model", "trim", "drivetrain", "hw_platform", "fsd",
                        "color", "condition"],
    },
    "skoda": {
        "numeric": ["age", "mileage_km", "power_hp"],
        "categorical": ["model", "fuel", "transmission", "drivetrain", "body",
                        "color", "condition"],
    },
}

# Skoda fuel-label normalisation (Marktplaats Dutch labels -> our canonical names).
FUEL_NORMALISE = {
    "benzine": "Petrol",
    "hybride elektrisch/benzine": "PHEV",
    "hybride elektrischbenzine": "PHEV",
    "diesel": "Diesel",
    "elektrisch": "Electric",
    "lpg": "LPG",
    "cng": "CNG",
    "overige brandstoffen": "Other",
}

# Skoda transmission-label normalisation (Marktplaats Dutch labels -> canonical).
TRANSMISSION_NORMALISE = {
    "automaat": "Automatic",
    "semi-automaat": "Automatic",
    "handgeschakeld": "Manual",
}

# --- Politeness ------------------------------------------------------------------
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36"
)
REQUEST_TIMEOUT = 30.0
# Random delay window (seconds) between detail-page fetches.
DETAIL_DELAY_RANGE = (0.8, 2.0)
SEARCH_DELAY_RANGE = (1.0, 2.5)
MAX_RETRIES = 4

# =================================================================================
# Extraction heuristics (Dutch + English). Order matters: more specific first.
# =================================================================================

# Canonical trims for Model 3 / Model Y. Each maps to a list of regex patterns that,
# if found in title+description (case-insensitive), select that trim.
TRIM_PATTERNS: list[tuple[str, list[str]]] = [
    ("Performance", [r"\bperformance\b", r"\bperf\b"]),
    ("Long Range", [
        r"long\s*range", r"\blr\b", r"maximale?\s*actieradius",
        r"groot\s*bereik", r"grote\s*actieradius", r"dual\s*motor.*long",
    ]),
    ("Standard Range Plus", [
        r"standard\s*range\s*plus", r"\bsr\+", r"sr\s*plus", r"standaard\s*plus",
    ]),
    ("Standard Range", [
        r"standard\s*range", r"\bsr\b", r"standaard\s*bereik",
    ]),
    # Drivetrain-named base trims (current Tesla naming).
    ("RWD", [
        r"\brwd\b", r"achterwielaandrijving", r"achterwiel", r"rear\s*wheel",
        r"single\s*motor",
    ]),
    ("AWD / Dual Motor", [
        r"\bawd\b", r"dual\s*motor", r"vierwielaandrijving", r"4wd",
        r"all\s*wheel", r"twin\s*motor",
    ]),
]

# "Highland" = the refreshed Model 3 (production from ~Oct 2023, EU deliveries 2024).
HIGHLAND_PATTERNS = [r"highland", r"nieuwe?\s*model\s*3"]
# "Juniper" = the refreshed Model Y (production from ~Jan 2025).
JUNIPER_PATTERNS = [r"juniper", r"nieuwe?\s*model\s*y"]
# Generic refresh wording — mapped to the right name based on the car's model.
# (Deliberately NOT "vernieuwde": too generic — it appears in unrelated ad prose.)
GENERIC_REFRESH_PATTERNS = [r"facelift", r"\brefresh\b"]
# Build-year fallbacks: a model built this year or later is the refreshed version
# even when the ad doesn't say so.
HIGHLAND_FROM_YEAR = 2024
JUNIPER_FROM_YEAR = 2025
# Hard floors: the refresh cannot predate production, so ignore a keyword match on
# an older car (sellers sometimes mention "Highland" on a pre-Highland listing).
HIGHLAND_MIN_YEAR = 2023
JUNIPER_MIN_YEAR = 2025

# Drivetrain detection (independent of trim label).
DRIVETRAIN_PATTERNS = {
    "AWD": [r"\bawd\b", r"dual\s*motor", r"vierwielaandrijving", r"4wd",
            r"all\s*wheel", r"twin\s*motor"],
    "RWD": [r"\brwd\b", r"achterwielaandrijving", r"rear\s*wheel", r"single\s*motor"],
}

# Full Self-Driving vs Enhanced Autopilot vs basic. FSD is the premium signal.
FSD_PATTERNS = [
    r"\bfsd\b", r"full\s*self[\s-]*driving", r"volledig\s*zelfrijdend",
    r"volledige?\s*zelfrijdende?\s*capaciteit", r"full\s*self\s*driving\s*capability",
]
EAP_PATTERNS = [
    r"enhanced\s*autopilot", r"\beap\b", r"verbeterde?\s*autopilot",
    r"uitgebreide?\s*autopilot",
]

# Hardware platform explicit mentions. Order matters: the 2.5 entry must precede
# the bare "HW2"/"AP2" entry so "hw2.5"/"ap2.5" resolve to HW2.5, not HW2.
HW_EXPLICIT_PATTERNS = {
    "HW4": [r"\bhw\s*4\b", r"hardware\s*4", r"\bhw4\.0\b", r"\bap4\b", r"hardware\s*4\.0"],
    "HW3": [r"\bhw\s*3\b", r"hardware\s*3", r"\bhw3\.0\b", r"\bap3\b", r"hardware\s*3\.0"],
    "HW2.5": [r"\bhw\s*2\.5\b", r"hardware\s*2\.5", r"\bap2\.5\b"],
    "HW2": [r"\bhw\s*2\b", r"hardware\s*2\b", r"\bap2\b", r"autopilot\s*2\b"],
    "HW1": [r"\bhw\s*1\b", r"hardware\s*1\b", r"\bap1\b", r"autopilot\s*1\b"],
}

# State-of-Health: look for a battery-health phrase, then a nearby percentage.
SOH_CONTEXT_PATTERNS = [
    r"state\s*of\s*health", r"\bsoh\b", r"batterij\s*(gezondheid|conditie|status)",
    r"accu\s*(gezondheid|conditie)", r"battery\s*health", r"degradatie",
]

# Exterior colour normalisation (Marktplaats Dutch palette + common marketing names).
COLOR_NORMALISE = {
    "wit": "White", "pearl white": "White", "parelwit": "White",
    "zwart": "Black", "solid black": "Black", "diamond black": "Black",
    "grijs": "Grey", "zilver": "Silver", "zilver of grijs": "Grey",
    "midnight silver": "Grey", "quicksilver": "Silver",
    "blauw": "Blue", "deep blue": "Blue", "stealth grey": "Grey",
    "rood": "Red", "ultra red": "Red",
    "groen": "Green", "bruin of beige": "Beige",
}

# --- Price sanity ----------------------------------------------------------------
# A real Model 3/Y never sells below this; a lower headline price is a monthly
# lease quote or "vanaf" teaser. When the headline is below the floor we try to
# recover the true asking price from the description, else drop the listing.
MIN_PRICE_EUR = 5000
MAX_PRICE_EUR = 250000
# Words that, just before a € amount, mark it as the asking price.
PRICE_KEYWORDS = ["vraagprijs", "verkoopprijs", "rijklaar", "all-in", "all in", "prijs"]
# Words that mark a € amount as NOT the asking price (new price, lease, etc.).
PRICE_NEGATIVE_KEYWORDS = [
    "nieuw", "catalogus", "advies", "vanaf", "origine", "bijtelling",
    "per maand", "p/m", "pm", "lease", "huur", "borg", "aanbetaling", "korting",
]

# --- HW3/HW4 inference thresholds (best-effort; tunable) -------------------------
# Production-history heuristics for when the listing doesn't state the platform.
# Confidence reflects how clean the boundary is.
HW_INFERENCE = {
    # Model 3: HW4 only arrived with the Highland refresh (~Oct 2023).
    "Model 3": {
        "highland_is_hw4": True,
        "pre_highland_hw": "HW3",
    },
    # Model Y (EU/Berlin): transitioned to HW4 around Q4 2023 / early 2024.
    "Model Y": {
        "hw4_from_year": 2024,        # >= 2024 build -> HW4 (medium confidence)
        "hw3_to_year": 2022,          # <= 2022 build -> HW3 (high confidence)
        # 2023 is the ambiguous boundary year -> low confidence HW3.
    },
    # Model S spans every Autopilot generation. We only know the build *year*, so we
    # map each year to the platform that dominated that year's production; boundary
    # years (HW transitioned mid-year) get a low confidence. Explicit ad mentions win.
    #   AP1   Oct 2014 ┐  HW2  Oct 2016 ┐  HW2.5 Aug 2017 ┐  HW3 ~Apr 2019 ┐  HW4 ~Feb 2023
    # Ordered (year_to, value, confidence): first band whose year_to >= build year wins.
    "Model S": {
        "bands": [
            (2015, "HW1", "high"),     # 2013–2015: pre-AP / AP1, never HW2+
            (2016, "HW2", "low"),      # HW1->HW2 switch (Oct 2016)
            (2017, "HW2", "medium"),   # HW2 most of the year; late-2017 is HW2.5
            (2018, "HW2.5", "high"),
            (2019, "HW3", "low"),      # HW2.5->HW3 switch (~Apr 2019)
            (2022, "HW3", "high"),     # 2020–2022
            (2023, "HW4", "low"),      # HW3->HW4 switch (~Feb 2023)
            (9999, "HW4", "high"),     # 2024+
        ],
    },
}
