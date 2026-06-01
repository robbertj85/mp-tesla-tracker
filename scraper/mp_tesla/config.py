"""Central configuration: search params, attribute IDs, and extraction heuristics.

All values here were validated against the live Marktplaats endpoints on
2026-06-01 (see README "How the scraping works"). Keep tunable knobs here so the
rest of the package stays declarative.
"""
from __future__ import annotations

# --- Marktplaats search endpoint -------------------------------------------------
# The site's own internal JSON API. A plain GET with a realistic User-Agent works
# server-side (no browser/cookies needed); AWS WAF only rarely challenges.
SEARCH_URL = "https://www.marktplaats.nl/lrp/api/search"
BASE_URL = "https://www.marktplaats.nl"

# Category + attribute IDs (decoded from the real XHR the site fires).
L1_CATEGORY_ID = 91     # Auto's
L2_CATEGORY_ID = 2830   # Tesla
TESLA_BRAND_ATTR_ID = 10882

# Model facet attributeValueId -> canonical model name. We only track 3 and Y.
MODEL_ATTR_IDS = {
    "Model 3": 11736,
    "Model Y": 13853,
}

# Mirror of the user's reference query:
#   constructionYearFrom:2017 | PriceCentsTo:4500000 | postcode 3051VM
CONSTRUCTION_YEAR_FROM = 2017
PRICE_CENTS_TO = 4_500_000
POSTCODE = "3051VM"

PAGE_SIZE = 30           # site default; keep modest to look human
MAX_PAGES = 40           # safety cap (~1200 listings) — plenty for 3+Y
SORT_BY = "SORT_INDEX"   # default relevance

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

# Hardware platform explicit mentions.
HW_EXPLICIT_PATTERNS = {
    "HW4": [r"\bhw\s*4\b", r"hardware\s*4", r"\bhw4\.0\b", r"\bap4\b", r"hardware\s*4\.0"],
    "HW3": [r"\bhw\s*3\b", r"hardware\s*3", r"\bhw3\.0\b", r"\bap3\b", r"hardware\s*3\.0"],
    "HW2.5": [r"\bhw\s*2\.5\b", r"hardware\s*2\.5", r"\bap2\.5\b"],
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
}
