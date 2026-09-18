# Marktplaats Prijstracker — Tesla, Skoda & Ford

Tracks second-hand car listings on Marktplaats.nl over time and estimates a fair
price for any feature set using regression, with an interactive dashboard (scatter
plots, per-model trend lines, filters, a client-side price estimator, and
price-history charts).

**Each tracker is kept completely separate** (own data files, own regression,
own dashboard route) and is never mixed:

| Brand | Models | Scope |
|-------|--------|-------|
| **Tesla** | Model 3 & Model Y | build year ≥ 2017; HW3/HW4, FSD, trim, battery SoH |
| **Skoda** | Octavia & Superb | build year ≥ 2019; **petrol + PHEV only**, **automatic only**, **Combi only**; brand/model/engine-driveline/odometer/price |
| **Octavia '06–'14** | Octavia (all bodies) | build years 2006–2014; **all fuels + both gearboxes** (automatic vs manual split in the dashboard) — a resale view for an older Octavia |
| **Model S** | Tesla Model S | build year ≥ 2013; **mileage ≤ 250.000 km**; Autopilot platform inferred across **HW1/HW2/HW2.5/HW3/HW4** from build year (explicit ad mentions win) |
| **Enyaq** | Skoda Enyaq (iV + Coupé) | build year ≥ 2020; **fully electric only**; **battery variant (50/60/80/80x/85/85x/RS) + usable kWh**, **Coupé vs SUV**, equipment line, drivetrain, odometer, power, price |
| **Mach-E** | Ford Mustang Mach-E | build year ≥ 2020; **fully electric only** (Marktplaats files it under "Mustang", so the fuel filter separates it from the petrol coupé); **battery pack (Standard / Extended Range, GT, Rally)**, drivetrain, odometer, power, price |

Every tracker also carries **equipment flags** — ACC, premium audio, panoramic
roof, seat memory, adaptive suspension and tow bar (trekhaak) — filterable in the
dashboard. See "Equipment options" below.

Everything brand-specific lives in the `BRANDS` registry in
`scraper/mp_tesla/config.py`; the rest of the pipeline is brand-generic and takes a
`Brand` as input.

```
┌─ GitHub Action (daily) ──────────────┐      ┌─ Vercel (Next.js) ───────────────┐
│ python -m mp_tesla.run               │      │ reads web/public/<brand>.json    │
│  for each brand:                     │ ───▶ │ /tesla · /skoda · /octavia · /model-s · /enyaq · /mach-e │
│  scrape → extract → upsert JSON      │ git  │ scatter · filters · table        │
│  → regression → export <brand>.json  │push  │ · fair-price estimator           │
│  → commit data/<brand> + web/public  │      │ auto-redeploy on commit          │
└──────────────────────────────────────┘      └──────────────────────────────────┘
```

No database — each brand's dataset lives in committed JSON files. The daily Action
commits updates, which triggers a Vercel redeploy.

## Layout

| Path | What |
|------|------|
| `scraper/mp_tesla/` | Python scraper + feature extraction + regression (brand-generic; `config.BRANDS` registry) |
| `data/<brand>/listings.json` | Canonical store per brand: `{id: record}` with `first_seen`/`last_seen`/`active` |
| `data/<brand>/price_history.json` | `{id: [{date, priceEur}]}` — appended only on price change |
| `web/` | Next.js + Tailwind + shadcn/ui + Recharts dashboard (Vercel root) |
| `web/public/<brand>.json` | Generated artifact the frontend reads (`tesla.json`, `skoda.json`, `octavia.json`, `model-s.json`, `enyaq.json`, `mach-e.json`) |
| `web/app/[brand]/` | Per-brand routes: `/tesla`, `/skoda`, `/octavia`, `/model-s`, `/enyaq`, `/mach-e` (+ `/modellen`) |
| `web/lib/brands.ts` | Per-brand UI config (which dimensions/columns/filters to show) |
| `.github/workflows/scrape.yml` | Daily cron + manual `workflow_dispatch` |

## How the scraping works

Marktplaats exposes an internal JSON search API; a plain request with a realistic
User-Agent works server-side (validated 2026-06-01).

1. **Search** (`search.py`) — `GET /lrp/api/search` with the brand's category +
   `attributesById[]` value-ids. Tesla: `Tesla 10882` + Model 3 `11736` + Model Y
   `13853`, year ≥ 2017. Skoda: category `151` + Octavia `1185` + Superb `1186`,
   fuel Benzine `473` + PHEV `13838`, transmission Automaat `534`, body Stationwagon
   `484`, year ≥ 2019. Octavia '06–'14: category `151` + Octavia `1185`, no
   fuel/transmission/body filter, `constructionYear:2006:2014`. Enyaq: category
   `151` + Enyaq `13808` + fuel Elektrisch `11756`, year ≥ 2020. Mach-E: category
   `112` (Ford) + Mustang `11739` + fuel Elektrisch `11756`, year ≥ 2020.
   A search page that comes back empty is re-asked (`EMPTY_PAGE_RETRIES`) before
   pagination stops — Marktplaats intermittently answers a valid query with an
   empty 200, which would otherwise silently truncate a brand's scrape.
   The response already carries model/year/mileage/price (+ fuel/transmission for
   Skoda); a post-fetch guard re-checks model (+ fuel/transmission for Skoda).
2. **Detail** (`detail.py`) — each listing's VIP page embeds `window.__CONFIG__`
   with rich `carAttributes` (color, power, body, seats, condition, drivetrain)
   plus the full free-text description. A Playwright fallback (`browser.py`) handles
   rare blocks.
3. **Record** (`record.py`) — builds a shared core then a brand block:
   *Tesla* = trim/Highland/HW/FSD/SoH heuristics (`extract.py` + `infer.py`);
   *Skoda* = fuel (Petrol/PHEV) + transmission (Automatic) + drivetrain (FWD/AWD);
   *Enyaq* = the Skoda block plus battery variant, usable kWh, equipment line and
   Coupé-vs-SUV (`enyaq.py`); *Mach-E* = the Skoda block plus the battery pack
   (`mache.py`) — from the title ("RWD 75 kWh", "Extended AWD 98 kWh", "GT") first,
   power only for the unambiguous bands (~480 pk = GT, ~351 pk = Extended AWD). The variant comes from the structured power figure
   first and the title text second — the two agree on 98.6% of ads. The power map
   is **year-aware**: 204 hp is the pre-facelift *80* but the post-facelift *60*,
   so a flat map would mislabel every facelift 60 and overstate its battery by
   18 kWh. Marktplaats reports "SUV of Terreinwagen" for the Coupé too, so the
   body split is derived from the ad text.
4. **Store** (`store.py`) — idempotent per-brand upsert; re-running the same day adds
   no duplicate history; listings missing for 2 runs are marked inactive (sold).
5. **Model** (`model.py`) — Ridge regression over the brand's `FEATURE_SPECS`
   (Tesla: model/trim/age/mileage/drivetrain/hw/fsd/color/condition/power/range;
   Skoda: model/fuel/transmission/drivetrain/body/age/mileage/power/color/condition;
   Enyaq: variant/battery_kwh/equipment_line/body/drivetrain/age/mileage/power/
   color/condition — fuel and transmission are dropped because every car is an
   electric automatic, so they carry no signal).
   Exported so the Next.js estimator reproduces the exact prediction client-side;
   reports R²/MAE and a gradient-boosted MAE benchmark.

## Equipment options

Each record carries six booleans — `acc`, `premium_audio`, `pano`, `seat_memory`,
`adaptive_suspension`, `tow_hitch` — configured in `EQUIPMENT_OPTIONS`
(`config.py`). An option is present when the seller ticked the matching
Marktplaats "Opties" checkbox (kept per record as `mp_options`) **or** the ad text
mentions it positively; negated ("geen/zonder …") and prep-only ("trekhaak
voorbereiding") mentions don't count. Seat memory and adaptive suspension have no
Marktplaats checkbox, so they are text-only. What "premium audio" means differs
per car:

| Tracker | Premium audio | Source |
|---------|---------------|--------|
| Tesla Model 3 | LR / Performance / Dual Motor (subwoofer system); SR / SR+ / RWD are standard audio | trim (+ text) |
| Tesla Model Y | every pre-Juniper trim; Juniper LR / Performance | trim (+ text) |
| Tesla Model S | standard from 2016; before that the optional Ultra High Fidelity Sound | year (+ text) |
| Skoda Octavia / Superb | Canton sound system (option; standard on Superb L&K) | "Sound system" checkbox + text |
| Octavia '06–'14 | Canton (rare in this era) | checkbox + text |
| Enyaq | Canton (option) | checkbox + text |
| Mach-E | Bang & Olufsen | checkbox + text |

Text detection misses cars whose ad doesn't mention an option, so "without" in the
filter means "not mentioned", not "certainly absent".

## Run the scraper locally

```bash
cd scraper
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"                       # add ",browser" for the Playwright fallback
python -m mp_tesla.run --limit 20             # dev: all brands, cap listings/brand
python -m mp_tesla.run --brand skoda --limit 20   # one brand only
python -m mp_tesla.rederive --brand tesla     # recompute from stored data (no network)
pytest                                        # unit tests
```

Outputs land in `data/<brand>/*.json` and `web/public/<brand>.json`. Re-run to confirm
the upsert is idempotent (stable counts, no duplicate price points).

## Run the dashboard locally

```bash
cd web
npm install
npm run dev        # http://localhost:3000 → redirects to /tesla; also /skoda
```

## Deploy

- **Vercel**: import the repo, set **Root Directory = `web`**. No env vars needed —
  it reads the committed `web/public/<brand>.json`. Each data commit auto-redeploys.
- **GitHub Actions**: `scrape.yml` runs daily and on manual dispatch, scraping all
  brands and committing refreshed data back to the repo. Needs no secrets (uses the
  default `GITHUB_TOKEN`).

## Caveats

- **HW3/HW4 is partly inferred** (Tesla) from build date/model. The UI flags
  confidence and marks inferred values with `*`. Thresholds live in `config.py`.
- **Trim / FSD / SoH** (Tesla) come from free-text and may be missing or occasionally
  wrong; Performance is guarded to require AWD + high power.
- **Skoda** fuel/transmission/drivetrain come from Marktplaats' structured
  attributes; the search is hard-filtered to petrol + PHEV + automatic + year ≥ 2019.
- Scraping is polite (daily, throttled, backoff). Respect Marktplaats' Terms of Service.
