# Tesla Prijstracker — Marktplaats Model 3 & Model Y

Tracks second-hand **Tesla Model 3 and Model Y** listings on Marktplaats.nl over
time and estimates a fair price for any feature set using regression, with an
interactive dashboard (scatter plots, per-model trend lines, filters, a
client-side price estimator, and price-history charts).

```
┌─ GitHub Action (daily) ─────────────┐      ┌─ Vercel (Next.js) ─────────┐
│ python -m mp_tesla.run              │      │ reads web/public/data.json │
│  scrape → extract → upsert JSON     │ ───▶ │ scatter · filters · table  │
│  → regression → export data.json    │ git  │ · fair-price estimator     │
│  → commit data/ + web/public        │push  │ auto-redeploy on commit    │
└─────────────────────────────────────┘      └────────────────────────────┘
```

No database — the dataset lives in committed JSON files. The daily Action commits
updates, which triggers a Vercel redeploy.

## Layout

| Path | What |
|------|------|
| `scraper/mp_tesla/` | Python scraper + feature extraction + regression |
| `data/listings.json` | Canonical store: `{id: record}` with `first_seen`/`last_seen`/`active` |
| `data/price_history.json` | `{id: [{date, priceEur}]}` — appended only on price change |
| `web/` | Next.js + Tailwind + shadcn/ui + Recharts dashboard (Vercel root) |
| `web/public/data.json` | Generated artifact the frontend reads |
| `.github/workflows/scrape.yml` | Daily cron + manual `workflow_dispatch` |

## How the scraping works

Marktplaats exposes an internal JSON search API; a plain request with a realistic
User-Agent works server-side (validated 2026-06-01).

1. **Search** (`search.py`) — `GET /lrp/api/search` filtered to Tesla (`attributesById 10882`)
   + Model 3 (`11736`) + Model Y (`13853`), `constructionYear>=2017`, `price<=€45k`.
   Returns structured price/year/mileage/model.
2. **Detail** (`detail.py`) — each listing's VIP page embeds `window.__CONFIG__`
   with rich `carAttributes` (color, power, body, seats, condition) plus the full
   free-text description. A Playwright fallback (`browser.py`) handles rare blocks.
3. **Extract** (`extract.py`) — Dutch/English heuristics derive **trim**, **FSD vs
   Enhanced Autopilot**, **battery SoH**, and explicit **HW** mentions from the text.
4. **Infer** (`infer.py`) — when HW isn't stated, derive **HW3/HW4** from model +
   build year + Highland status, each with a **confidence** flag (shown in the UI).
5. **Store** (`store.py`) — idempotent upsert; re-running the same day adds no
   duplicate history; listings missing for 2 runs are marked inactive (sold).
6. **Model** (`model.py`) — Ridge regression (interpretable, exported for the
   client-side estimator) over model/trim/age/mileage/drivetrain/hw/fsd/color/
   condition/power/range; reports R²/MAE and a gradient-boosted MAE benchmark.

## Run the scraper locally

```bash
cd scraper
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"            # add ",browser" for the Playwright fallback
python -m mp_tesla.run --limit 20  # dev: cap listings; omit --limit for a full run
pytest                             # unit tests (extract/infer/detail/store/model)
```

Outputs land in `data/*.json` and `web/public/data.json`. Re-run to confirm the
upsert is idempotent (stable counts, no duplicate price points).

## Run the dashboard locally

```bash
cd web
npm install
npm run dev        # http://localhost:3000
```

## Deploy

- **Vercel**: import the repo, set **Root Directory = `web`**. No env vars needed —
  it reads the committed `web/public/data.json`. Each data commit auto-redeploys.
- **GitHub Actions**: `scrape.yml` runs daily and on manual dispatch, committing
  refreshed data back to the repo. Needs no secrets (uses the default `GITHUB_TOKEN`).

## Caveats

- **HW3/HW4 is partly inferred** from build date/model. The UI flags confidence and
  marks inferred values with `*`. Thresholds live in `scraper/mp_tesla/config.py`.
- **Trim / FSD / SoH** come from free-text and may be missing or occasionally wrong;
  Performance is guarded to require AWD + high power to avoid prose false-positives.
- Scraping is polite (daily, single query, throttled, backoff). Respect Marktplaats'
  Terms of Service.
