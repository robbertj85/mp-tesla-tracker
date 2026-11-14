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

import re
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

# --- Tesla.com official used-inventory endpoint ----------------------------------
# Tesla's own inventory API (same JSON the inventory pages call). It sits behind
# Akamai Bot Manager, so a plain request is denied — tesla_inventory.py fetches it
# through a real browser session (Playwright) that first passes the bot check.
# The canonical model -> Tesla url/query slug ("Model Y" -> "my").
TESLA_INVENTORY_API = "https://www.tesla.com/inventory/api/v4/inventory-results"
TESLA_INVENTORY_PAGE = "https://www.tesla.com/nl_NL/inventory/used/{slug}?arrangeby=plh&zip={zip}&range=0"
TESLA_ORDER_URL = "https://www.tesla.com/nl_NL/{slug}/order/{vin}?titleStatus=used"
TESLA_MARKET = "NL"
TESLA_LANGUAGE = "nl"
TESLA_ZIP = "3012"
TESLA_LAT = 51.9235
TESLA_LNG = 4.4813
TESLA_PAGE_SIZE = 50          # inventory API count per page
TESLA_MAX_PAGES = 20          # safety cap (~1000 cars/model)
# Tesla query slug -> our canonical model name (and back, for the order URL).
TESLA_MODEL_SLUGS = {"m3": "Model 3", "my": "Model Y", "ms": "Model S"}

# --- Gaspedaal.nl (source="gaspedaal") --------------------------------------------
# Aggregator of Dutch dealer stock (AutoScout24, AutoTrack, dealer sites, ...).
# Each search page embeds its first 100 occasions as structured JSON (Next.js
# flight data). robots.txt disallows every URL with a query string, so `?page=N`
# is off-limits; we only fetch the path URLs it allows — the model page plus its
# single-filter slices (`/<make>/<model>/<year>`, `/<make>/<model>/<colour>`, …),
# each capped at 100 cars — and union them by advertentieId (see gaspedaal.py).
GASPEDAAL_BASE_URL = "https://www.gaspedaal.nl"
GASPEDAAL_PAGE_CAP = 100      # occasions embedded per page
# Portal preference for the record URL (Gaspedaal's click-out redirects there).
GASPEDAAL_PORTAL_ORDER = ("Dealersite", "AutoScout24", "AutoTrack", "viaBOVAG.nl", "ANWB")
# Gaspedaal enum -> the Marktplaats label the rest of the pipeline (guards,
# FUEL_NORMALISE, TRANSMISSION_NORMALISE) already understands.
GASPEDAAL_FUEL = {
    "ELEKTRICITEIT": "Elektrisch", "BENZINE": "Benzine", "DIESEL": "Diesel",
    "LPG": "LPG", "CNG": "CNG",
    # "HYBRIDE" covers both plug-in (iV/PHEV) and mild hybrids (e-TEC/e-TSI);
    # gaspedaal.py splits it on the title.
}
GASPEDAAL_TRANSMISSION = {"AUTOMATISCH": "Automaat", "HANDMATIG": "Handgeschakeld"}
GASPEDAAL_BODY = {
    "STATIONWAGEN": "Stationwagon", "SUV": "SUV of Terreinwagen", "HATCHBACK": "Hatchback",
    "SEDAN": "Sedan", "MPV": "MPV", "COUPE": "Coupé", "CABRIO": "Cabriolet",
}


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
    # Tesla.com official used-inventory models to also pull into this brand's store
    # (source="tesla"). e.g. ("m3", "my") for the tesla brand, ("ms",) for model-s.
    # Empty = no Tesla-inventory source (Skoda/Octavia).
    tesla_inventory_models: tuple = ()
    # Gaspedaal.nl model pages to also pull into this brand's store (source=
    # "gaspedaal"), as (canonical model, "<make>/<model>" path) pairs. The brand's
    # year/price/mileage/fuel/transmission/body scope is applied after fetching.
    gaspedaal_models: tuple = ()
    # Regex (case-insensitive) on the title that drops a listing from the scope —
    # for brands whose model id also covers non-EV versions a seller can mis-file
    # as electric (the Niro hybrid / PHEV). None = no title guard.
    title_exclude: str | None = None

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
        tesla_inventory_models=("m3", "my"),
        gaspedaal_models=(("Model 3", "tesla/model-3"), ("Model Y", "tesla/model-y")),
        source_query="auto-s/tesla | Model 3 + Model Y | constructionYear>=2017 | price<=45000 + Tesla.com occasions + Gaspedaal",
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
        gaspedaal_models=(("Octavia", "skoda/octavia"), ("Superb", "skoda/superb")),
        source_query="auto-s/skoda | Octavia + Superb Combi | benzine + PHEV | automaat | constructionYear>=2019 + Gaspedaal",
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
        # No Gaspedaal source: it lists dealer stock only (these cars mostly sell
        # privately) and has no year slices before 2010, so coverage would be thin.
        pipeline="skoda",
        source_query="auto-s/skoda | Octavia (alle uitvoeringen) | constructionYear 2006–2014",
    ),
    # Skoda Enyaq (iV / Coupé) — Skoda's full-electric SUV. Production started late
    # 2020, so year_from=2020 catches the handful of first-registration-2020 cars.
    # Reuses the Skoda extraction pipeline; the only hard filter is fuel = Elektrisch
    # (a stray listing is tagged "Overige brandstoffen"). No body filter: Marktplaats
    # tags both the SUV and the Coupé as "SUV of Terreinwagen", and no transmission
    # filter is needed since every EV is a single-speed automatic.
    "enyaq": Brand(
        key="enyaq",
        label="Skoda Enyaq",
        l2_category_id=151,
        models={"Enyaq": 13808},
        fuel_ids=(11756,),
        allowed_fuels=("Elektrisch",),
        year_from=2020,
        year_to=None,
        price_cents_to=6_000_000,   # <= €60,000 (a nearly-new 85 Sportline tops ~€57k)
        min_price_eur=5000,
        pipeline="enyaq",
        # Gaspedaal files the Coupé under the same "Enyaq iV" model.
        gaspedaal_models=(("Enyaq", "skoda/enyaq-iv"),),
        source_query="auto-s/skoda | Enyaq (iV + Coupé) | elektrisch | constructionYear>=2020 | price<=60000 + Gaspedaal",
    ),
    # Ford Mustang Mach-E (full-electric crossover, EU deliveries from 2021).
    # Marktplaats has no separate Mach-E model: it sits under "Mustang" (11739), so
    # the fuel filter Elektrisch (11756) is what separates it from the petrol coupé.
    # Reuses the Skoda block for fuel/transmission/driveline; mache.py adds the
    # battery variant (Standard / Extended Range, GT, Rally) as `trim`.
    "mach-e": Brand(
        key="mach-e",
        label="Ford Mustang Mach-E",
        l2_category_id=112,
        models={"Mustang": 11739},
        fuel_ids=(11756,),
        allowed_fuels=("Elektrisch",),
        year_from=2020,
        year_to=None,
        price_cents_to=8_000_000,   # <= €80,000 (a new GT sits around €75k)
        min_price_eur=5000,
        pipeline="mache",
        gaspedaal_models=(("Mustang", "ford/mustang-mach-e"),),
        source_query="auto-s/ford | Mustang Mach-E | elektrisch | constructionYear>=2020 | price<=80000 + Gaspedaal",
    ),
    # Volkswagen ID.4 (full-electric SUV, deliveries from late 2020). The Enyaq's
    # MEB sibling, so the same battery split matters: Pure (52 kWh) vs Pro (77 kWh),
    # with the Pro 4MOTION and GTX (AWD) on top. Reuses the Skoda block for
    # fuel/transmission/driveline; id4.py adds the variant (as `trim`), the usable
    # battery and the equipment line. The ID.5 (the coupé) is a separate model on
    # Marktplaats (13776) and is not tracked here.
    "id4": Brand(
        key="id4",
        label="Volkswagen ID.4",
        l2_category_id=157,
        models={"ID.4": 13144},
        fuel_ids=(11756,),
        allowed_fuels=("Elektrisch",),
        year_from=2020,
        year_to=None,
        price_cents_to=6_000_000,   # <= €60,000 (a new GTX sits around €55k)
        min_price_eur=5000,
        pipeline="id4",
        gaspedaal_models=(("ID.4", "volkswagen/id4"),),
        source_query="auto-s/volkswagen | ID.4 | elektrisch | constructionYear>=2020 | price<=60000 + Gaspedaal",
    ),
    # Kia Niro EV (full-electric compact crossover). Marktplaats files both
    # generations under one model "Niro" (11678) together with the hybrid and the
    # PHEV, so the fuel filter Elektrisch (11756) keeps only the EV. niro.py
    # derives the variant (as `trim`): the first-gen e-Niro 39 / 64 kWh or the
    # second-gen Niro EV 64.8 kWh, plus the usable battery and the equipment line.
    # Gaspedaal lists the two generations as separate models.
    "niro": Brand(
        key="niro",
        label="Kia Niro EV",
        l2_category_id=119,
        models={"Niro": 11678},
        fuel_ids=(11756,),
        allowed_fuels=("Elektrisch",),
        year_from=2019,
        year_to=None,
        price_cents_to=5_000_000,   # <= €50,000 (a new Niro EV sits around €45k)
        min_price_eur=5000,
        pipeline="niro",
        gaspedaal_models=(("Niro", "kia/e-niro"), ("Niro", "kia/niro-ev")),
        title_exclude=r"\bphev\b|plug[\s-]*in|\bhybrid|\b1[.,]6\s*t?-?gdi",
        source_query="auto-s/kia | Niro (e-Niro + Niro EV) | elektrisch | constructionYear>=2019 | price<=50000 + Gaspedaal",
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
        tesla_inventory_models=("ms",),
        gaspedaal_models=(("Model S", "tesla/model-s"),),
        source_query="auto-s/tesla | Model S | constructionYear>=2013 | km<=250000 | price<=100000 + Tesla.com occasions + Gaspedaal",
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
    # Enyaq: fuel and transmission are constant across the whole tracker (every car
    # is electric with a single-speed automatic), so they carry no signal and are
    # dropped. Battery size and variant replace them as the real price drivers, and
    # `body` becomes meaningful here because we split Coupé from SUV ourselves.
    "enyaq": {
        "numeric": ["age", "mileage_km", "power_hp", "battery_kwh"],
        "categorical": ["model", "trim", "equipment_line", "drivetrain", "body",
                        "color", "condition"],
    },
    # Mach-E: like the Enyaq, fuel/transmission are constant; the battery variant
    # (in `trim`) and the driveline carry the price.
    "mache": {
        "numeric": ["age", "mileage_km", "power_hp"],
        "categorical": ["model", "trim", "drivetrain", "color", "condition"],
    },
    # ID.4: like the Mach-E the variant (in `trim`) carries the battery, so
    # battery_kwh would only duplicate it; the equipment line (1st Max, Style, …)
    # adds the trim-level spread the Enyaq tracker also models.
    "id4": {
        "numeric": ["age", "mileage_km", "power_hp"],
        "categorical": ["model", "trim", "equipment_line", "drivetrain", "color", "condition"],
    },
    # Niro EV: every car is front-wheel drive, so the driveline carries no signal.
    # The variant (in `trim`) carries generation + battery; the equipment line
    # (DynamicLine … ExecutiveLine) the trim-level spread. Power is left out: it
    # follows from the variant (136 / 204 hp), and ~5% of ads state a wrong
    # figure (39, 68, 87 hp) that would only add noise.
    "niro": {
        "numeric": ["age", "mileage_km"],
        "categorical": ["model", "trim", "equipment_line", "color", "condition"],
    },
}

# =================================================================================
# Volkswagen ID.4 variants (see id4.py)
# =================================================================================
# The 2024 update (APP550 motor) re-powered the 77 kWh cars: the Pro went from
# 174/204 hp to 286 hp, the Pro 4MOTION from 265 to 286 hp, the GTX from 299 to
# 340 hp. The Pure (52 kWh) kept 148/170 hp.
ID4_UPDATE_YEAR = 2024

# Variant from the structured power figure: (hp values, variant). 286 hp is the
# 2024+ Pro AND Pro 4MOTION, so it maps to "Pro" and the driveline promotes it.
ID4_POWER_VARIANTS: list[tuple[tuple[int, ...], str]] = [
    ((148, 150, 170), "Pure"),
    ((174, 204, 286), "Pro"),
    ((265,), "Pro 4MOTION"),
    ((299, 300, 340), "GTX"),
]

# Variant from the title. Sellers nearly always quote the pack ("Pro 77 kWh",
# "Pure 52 kWh"); 79/82 kWh are the 2024+ net / the gross figure of the big pack.
ID4_GTX_PATTERN = re.compile(r"\bgtx\b", re.I)
ID4_4MOTION_PATTERN = re.compile(r"4\s*motion", re.I)
ID4_PURE_PATTERN = re.compile(r"\bpure\b|\bcity\b|\b(?:52|55)(?:[.,]\d)?\s*kwh", re.I)
ID4_PRO_PATTERN = re.compile(r"\bpro\b|\b(?:1st|first)\b|\b(?:77|79|82)(?:[.,]\d)?\s*kwh", re.I)

# Usable battery capacity per variant (kWh). Gross is 55 / 82 kWh.
ID4_BATTERY_KWH = {"Pure": 52.0, "Pro": 77.0, "Pro 4MOTION": 77.0, "GTX": 77.0}

# Equipment lines, most specific first (first match wins). Matched on the TITLE
# only: descriptions use "max" ("max. 11 kW laden") and "first" too loosely.
ID4_EQUIPMENT_LINES: list[tuple[str, list[str]]] = [
    ("1st Max", [r"\b(?:1st|first)\s*max\b"]),
    ("1st Edition", [r"\b(?:1st|first)\b"]),
    ("Max", [r"\bmax\b"]),
    ("Limited Edition", [r"limited\s*edition"]),
    ("Style", [r"\bstyle\b"]),
    ("Tech", [r"\btech\b"]),
    ("Family", [r"\bfamily\b"]),
    ("Business", [r"\bbusiness\b"]),
    ("Life", [r"\blife\b"]),
    ("City", [r"\bcity\b"]),
    ("Goal", [r"\bgoal\b"]),
    ("Advantage", [r"\badvantage\b"]),
]

# =================================================================================
# Kia Niro EV variants (see niro.py)
# =================================================================================
# The first-gen e-Niro ran to 2022, the second-gen Niro EV was delivered from
# mid-2022. Outside 2022 the build year decides; 2022 cars go by the title and
# stay unknown without a generation cue.
NIRO_GEN1_LAST_YEAR = 2021
NIRO_GEN2_FIRST_YEAR = 2023

# 136 hp (100 kW) is the 39 kWh e-Niro; every 64 / 64.8 kWh car makes 204 hp.
NIRO_SMALL_PACK_HP = (135, 136)
NIRO_39_PATTERN = re.compile(r"\b39(?:[.,]\d)?\s*kwh", re.I)
# Kia's own names: "e-Niro … 64 kWh" (gen 1), "Niro EV … 64.8 kWh" (gen 2).
# "Niro EV" alone is not enough when the title also says e-Niro.
NIRO_GEN2_PATTERN = re.compile(
    r"\b64[.,]8\s*kwh|\b(?:light|air|plus)\s+(?:edition|advanced)\b|\bedition\s+advanced\b"
    r"|(?<![e-])\bniro\s+ev\b(?!.*\be-?niro\b)", re.I)
NIRO_GEN1_PATTERN = re.compile(r"\be[\s-]?niro\b|\b64\s*kwh", re.I)

# Equipment lines that ship premium audio and memory seats as standard (Kia NL
# price lists 2019–2026): JBL on every e-Niro ExecutiveLine, Harman Kardon on the
# Niro EV ExecutiveLine / Plus Advanced. ExecutiveLine was 64 kWh only.
NIRO_PREMIUM_LINES = ("ExecutiveLine", "Plus Advanced")

# Usable battery capacity per variant (kWh).
NIRO_BATTERY_KWH = {"e-Niro 39": 39.2, "e-Niro 64": 64.0, "Niro EV": 64.8}

# Equipment lines, most specific first (first match wins), matched on the TITLE.
# The "…Line" names exist in both generations; Light / Air / Edition / Plus
# (Advanced) are second-gen names. Sellers write "DynamicPlusLine" as
# "Dynamic Plus Line" too.
NIRO_EQUIPMENT_LINES: list[tuple[str, list[str]]] = [
    ("DynamicPlusLine", [r"dynamic\s*plus\s*line"]),
    ("DynamicLine", [r"dynamic\s*line"]),
    ("ExecutiveLine", [r"executive\s*line"]),
    ("ComfortLine", [r"comfort\s*line"]),
    ("Edition Advanced", [r"\bedition\s+advanced\b"]),
    ("Plus Advanced", [r"\bplus\s+advanced\b"]),
    ("Light Advanced", [r"\blight\s+advanced\b"]),
    ("Light Edition", [r"\blight\s+edition\b"]),
    ("Light", [r"\blight\b"]),
    ("Air", [r"\bair\b"]),
    ("First Edition", [r"\b(?:first|1st)\s+edition\b"]),
    ("Edition", [r"\bedition\b"]),
]

# =================================================================================
# Ford Mustang Mach-E variants (see mache.py)
# =================================================================================
# Sellers quote the battery in the title almost always, mostly as the gross figure
# (75.7 / 98.7 kWh -> "75 kWh" / "98 kWh"), sometimes the usable one (68/70 vs 88/91)
# or the 2024+ figures (73/76 vs 91/99). GT and Rally are always the Extended pack.
MACHE_TEXT_VARIANTS: list[tuple[str, re.Pattern]] = [
    ("Rally", re.compile(r"\brally\b", re.I)),
    ("GT", re.compile(r"\bgt\b", re.I)),
    ("Extended Range", re.compile(r"extended|\ber\b|\b(?:88|91|98|99)(?:[.,]\d)?\s*kwh", re.I)),
    ("Standard Range", re.compile(r"standard|\bsr\b|\b(?:68|70|72|73|75|76)(?:[.,]\d)?\s*kwh", re.I)),
]
# Power fallback (pk) when the title names no variant. Only the unambiguous bands:
# the GT/Rally (~480 pk) and the Extended AWD (~351 pk). The Standard (~269 pk) and
# Extended RWD (~294 pk, later 276 pk) overlap across model years, so they're left
# to the text rather than guessed.
MACHE_POWER_VARIANTS: list[tuple[int, int, str]] = [
    (440, 520, "GT"),
    (330, 370, "Extended Range"),
]

# Trim level from the title. Ford NL sold the Mach-E as the base car or the richer
# "Premium" (2021+), plus the launch "First Edition"; 2024+ the base is "Select".
# "Premium audio/sound" in a dealer's option list is the sound system, not the trim.
MACHE_EQUIPMENT_LINES: list[tuple[str, re.Pattern]] = [
    ("First Edition", re.compile(r"first\s*edition", re.I)),
    ("Premium", re.compile(r"\bpremium\b(?![\s-]*(?:audio|sound|geluid|hi-?fi|speakers?|pakket|pack))", re.I)),
    ("Select", re.compile(r"\bselect\b", re.I)),
]

# =================================================================================
# Skoda Enyaq variants (see enyaq.py for how these are applied)
# =================================================================================
# The 2024 facelift renamed and re-powered the range, so several figures only make
# sense together with the build year.
ENYAQ_FACELIFT_YEAR = 2024

# Variant from the structured power figure: (hp values, year_from, year_to, variant).
# First matching row wins, so the year-bounded rows must precede the open ones.
#   pre-facelift: 50 = 148 hp · 60 = 179/180 hp · 80 = 204 hp · 80x = 265 hp · RS = 299 hp
#   facelift:     60 = 204 hp · 85/85x = 286 hp · RS = 340 hp
# 204 hp is therefore the 80 *or* the 60 depending on the generation — the single
# most important reason this table is year-aware.
ENYAQ_POWER_VARIANTS: list[tuple[tuple[int, ...], int | None, int | None, str]] = [
    ((340,), None, None, "RS"),
    ((299, 300), None, None, "RS"),   # sellers round the pre-facelift RS's 299 hp
    ((286,), None, None, "85"),
    ((265,), None, None, "80x"),
    ((204,), ENYAQ_FACELIFT_YEAR, None, "60"),    # facelift 60
    ((204,), None, ENYAQ_FACELIFT_YEAR - 1, "80"),  # pre-facelift 80
    ((179, 180), None, None, "60"),
    ((148, 150), None, None, "50"),
]

# Variant from the title. The token must follow "Enyaq" / "Coupé" / "iV" so that
# "80.000 km", "SOH 90%", '21"' and prices can't be mistaken for a variant. Longer
# tokens first ('85x' before '85') since the alternation is ordered.
ENYAQ_VARIANT_PATTERN = re.compile(
    r"(?:enyaq|coup[eé]|\biv\b)[\s|/,-]*(?:iv[\s|/,-]*)?(85\s*x|85|80\s*x|80|60|50)\b",
    re.I,
)
ENYAQ_RS_PATTERN = re.compile(r"\brs\b", re.I)

# An AWD badge promotes a base variant to its all-wheel-drive twin — but ONLY for
# the pair that shares a power figure. The 85 and 85x are both 286 hp, so the
# driveline is the only thing telling them apart. The 80 (204 hp) and 80x (265 hp)
# are already separated by power, and promoting there on the seller-entered AWD
# attribute just mislabels 204 hp cars whose ad has the driveline wrong.
ENYAQ_AWD_TWIN = {"85": "85x"}

# Usable (not gross) battery capacity per variant, kWh. Gross figures are
# 55 / 62 / 82 kWh; usable is what the car actually delivers.
ENYAQ_BATTERY_KWH = {
    "50": 52.0,
    "60": 58.0,
    "80": 77.0, "80x": 77.0,
    "85": 77.0, "85x": 77.0,
    "RS": 77.0,
}
# The facelift 60 carries a slightly bigger pack (63 kWh gross) than the original,
# and is identified by its 204 hp motor (the original 60 makes 179/180 hp).
ENYAQ_BATTERY_KWH_FACELIFT_60 = 59.0
ENYAQ_FACELIFT_60_HP = (204,)

# Equipment / appearance lines, most distinctive first (first match wins). Only
# ~40% of ads name one. RS is deliberately absent: it is a variant, not a line.
ENYAQ_EQUIPMENT_LINES: list[tuple[str, list[str]]] = [
    ("Laurin & Klement", [r"laurin\s*(&|en|\+)?\s*klement", r"\bl&k\b"]),
    ("Sportline", [r"sport\s*line"]),
    ("Founders Edition", [r"founders?\s*edition"]),
    ("First Edition", [r"first\s*edition"]),
    ("Business Edition", [r"business\s*edition"]),
    ("Tour Edition", [r"tour\s*edition"]),
    ("Selection", [r"\bselection\b"]),
    ("Max", [r"\bmax\b"]),
]

# Coupé vs the regular SUV — Marktplaats labels both "SUV of Terreinwagen".
ENYAQ_COUPE_PATTERN = re.compile(r"coup[eé]", re.I)

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
# Marktplaats answers a perfectly valid search with an empty 200 (`listings: []`,
# `totalResultCount: 0`) when it decides we've asked for too much too quickly —
# it does NOT send a 429, so this is indistinguishable from "no more results".
# Since search.py stops paginating on an empty page, one such response would
# silently truncate a brand's scrape. Re-ask on this escalating backoff (seconds);
# the pause has to be tens of seconds — retrying a few seconds later just gets
# another empty page (measured 2026-08-03: 25s spacing recovered every offset).
# Only paid when the anomaly actually happens: normal pagination ends on
# `offset >= totalResultCount`, never on an empty page.
EMPTY_PAGE_BACKOFF = (15.0, 45.0, 90.0)
# Once throttling escalates, the search API answers 403 Forbidden (seen 2026-09-13..16,
# mid-run after a few hundred requests). The tenacity retries in search._fetch_page
# are spaced seconds apart — far too short to wait out the block — so a 403/429 that
# survives them is re-asked on this longer escalating backoff (seconds) before the
# brand is given up on.
BLOCKED_BACKOFF = (60.0, 180.0, 300.0)
BLOCKED_STATUSES = frozenset({403, 429})

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
        r"\brwd\b", r"achterwielaandrijving", r"achterwiel", r"rear[\s-]*wheel",
        r"single\s*motor",
    ]),
    ("AWD / Dual Motor", [
        r"\bawd\b", r"dual\s*motor", r"vierwielaandrijving", r"4wd",
        r"all[\s-]*wheel", r"twin\s*motor",
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
            r"all[\s-]*wheel", r"twin\s*motor"],
    "RWD": [r"\brwd\b", r"achterwielaandrijving", r"rear[\s-]*wheel", r"single\s*motor"],
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

# Equipment options, each a boolean record field (tow_hitch, acc, ...). An option
# counts as present when the seller ticked one of its `mp_options` in Marktplaats'
# structured "Opties" list, OR the ad text mentions it positively. Text mentions
# are skipped when a negation precedes them ("geen/zonder trekhaak") or when an
# `exclude` word sits nearby ("trekhaak voorbereiding" = prep, not fitted).
# Seat memory and adaptive suspension have no Marktplaats option, so text only.
OPTION_NEGATIVE = ("geen", "zonder", "niet", "without")
OPTION_EXCLUDE_COMMON = ("mogelijk", "optioneel", "kan worden", "te plaatsen",
                         "bij te bestellen", "tegen meerprijs")
EQUIPMENT_OPTIONS: dict[str, dict] = {
    "tow_hitch": {
        "patterns": [r"trek\s*haak", r"tow\s*bar", r"\btowbar\b", r"tow\s*hitch"],
        "mp_options": ["Trekhaak"],
        "exclude": ("voorbereid", "voorbereiding", "af fabriek mogelijk"),
    },
    "acc": {
        # Tesla's TACC is part of (Enhanced) Autopilot, so an Autopilot mention counts.
        # "LFP-acc" is shorthand for the LFP accu (battery), not cruise control.
        "patterns": [r"adaptie(?:ve|f)\s*cruise", r"adaptive\s*cruise", r"(?<!lfp[\s-])\bt?acc\b",
                     r"traffic[\s-]*aware", r"\bauto\s*pilot\b", r"\bautopiloot\b"],
        "mp_options": ["Adaptive Cruise Control", "AdaptiveCruiseControl"],
        "exclude": (),
    },
    "premium_audio": {
        # Brand systems + the generic "Audio installatie premium" dealer spec line
        # (Tesla's premium audio is sold as "High Performance Audio").
        "patterns": [r"premium\s*(?:audio|sound|geluid|hifi|hi-fi)", r"audio\s*installatie\s*premium",
                     r"high[\s-]*(?:end|performance)\s*audio", r"\bcanton\b",
                     r"harman\s*[/&-]?\s*kardon", r"bang\s*(?:&|and|en)\s*olufsen", r"\bb\s*&\s*o\b",
                     r"\bbose\b", r"\bmeridian\b", r"\bburmester\b", r"\bbowers\b",
                     r"\bjbl\b", r"\bdynaudio\b", r"\bmark\s*levinson\b", r"\bsubwoofer\b"],
        "mp_options": ["Sound system"],
        "exclude": (),
    },
    "pano": {
        # `\bpano` covers pano / panodak / panorama(dak) / panoramisch.
        "patterns": [r"\bpano", r"glazen\s*dak", r"glas\s*dak", r"glass\s*roof"],
        "mp_options": ["Panoramadak"],
        "exclude": (),
    },
    "seat_memory": {
        # Anchored on "stoel" so "buitenspiegels / stuurkolom met geheugen" don't count.
        "patterns": [r"stoel\w*(?:\(en\))?(?:\s+(?!stuur|spiegel|buiten)[\w.]+){0,3}?\s+(?:met\s+)?(?:geheugen|memory)",
                     r"stoelgeheugen", r"geheugen\w*\s*(?:voor\s*)?(?:de\s*)?(?:bestuurders)?stoel",
                     r"memory\s*(?:seats?|stoel|zetel|functie)", r"\bmemory\b(?!\s*(?:spiegel|stuur))"],
        "mp_options": [],
        "exclude": (),
    },
    "adaptive_suspension": {
        "patterns": [r"\bdcc\b", r"dynamic\s*chassis\s*control", r"adaptie(?:ve|f)\s*(?:onderstel|vering|demping|chassis|dempers)",
                     r"adaptive\s*(?:suspension|damp)", r"actie(?:ve|f)\s*(?:onderstel|vering|chassis)",
                     r"active\s*suspension", r"lucht\s*vering", r"air\s*suspension",
                     r"smart\s*air", r"elektronisch\s*(?:verstelbaar\s*)?onderstel",
                     r"variabele\s*demping", r"magne\s*ride"],
        "mp_options": [],
        "exclude": (),
    },
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
    # Bare English words so Tesla paint names ("Solid Black", "Pearl White
    # Multi-Coat", "Red Multi-Coat", "Deep Blue Metallic", …) normalise too.
    # normalise_color() matches these as substrings, so keep them generic.
    "white": "White", "black": "Black", "grey": "Grey", "gray": "Grey",
    "silver": "Silver", "blue": "Blue", "red": "Red", "green": "Green",
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
