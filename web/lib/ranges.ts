// Trim + range reference per model. Headline (as-new) WLTP figures are the same
// curated values the scraper uses to estimate battery health (scraper/mp_tesla/
// wltp.py, sourced from EV Database). "Praktijk" (real-world) figures are EV
// Database's Real Range estimates where marked `bron: "EV Database"`; the rest are
// estimates (~0.80 × WLTP year-round, ~0.67 × WLTP in cold winter) and marked
// `bron: "schatting"`. NL real-world sits roughly between the winter and summer
// numbers; motorway (110 km/h) is the worst common case.
import type { BrandKey } from "@/lib/brands";

export interface RangeFigures {
  /** As-new WLTP (km), common wheel. */
  wltp: number;
  /** EV Database "Real Range" combined (km), or an estimate. */
  real: number;
  /** Cold-weather (~-10 °C, heating) and mild-weather (~23 °C) combined (km). */
  winter: number;
  summer: number;
  /** Motorway @110 km/h, cold / mild (km). */
  highwayCold?: number;
  highwaySummer?: number;
  bron: "EV Database" | "schatting";
}

export interface TrimSpec {
  trim: string;
  drivetrain: "RWD" | "AWD";
  years: string;
  /** Usable battery (kWh), approx. */
  batteryKwh?: number;
  note?: string;
  range: RangeFigures;
}

export interface ModelTrims {
  model: string;
  blurb: string;
  trims: TrimSpec[];
}

const est = (wltp: number): Pick<RangeFigures, "real" | "winter" | "summer" | "bron"> => ({
  real: Math.round(wltp * 0.8),
  winter: Math.round(wltp * 0.67),
  summer: Math.round(wltp * 0.95),
  bron: "schatting",
});

export const TRIM_GUIDE: Partial<Record<BrandKey, ModelTrims[]>> = {
  tesla: [
    {
      model: "Model 3",
      blurb:
        "RWD (enkele motor, Standard Range Plus / RWD) is de instapper; Long Range is altijd Dual-Motor AWD. Highland-facelift vanaf eind 2023.",
      trims: [
        {
          trim: "RWD / Standard Range Plus",
          drivetrain: "RWD",
          years: "2019–2023",
          batteryKwh: 57,
          note: "WLTP liep op van 409 → 448 → 491 km (NCA → grotere LFP-accu eind 2021).",
          range: { wltp: 491, real: 350, winter: 290, summer: 410, highwayCold: 250, highwaySummer: 330, bron: "EV Database" },
        },
        {
          trim: "Long Range AWD",
          drivetrain: "AWD",
          years: "2019–2023",
          batteryKwh: 72,
          note: "WLTP 560 (2019) → 580 (2020) → 614 km (2021, Panasonic). Praktijkcijfer hoort bij de 580-uitvoering.",
          range: { wltp: 614, real: 465, winter: 390, summer: 540, highwayCold: 335, highwaySummer: 440, bron: "EV Database" },
        },
        {
          trim: "Performance AWD",
          drivetrain: "AWD",
          years: "2019–2023",
          batteryKwh: 72,
          note: "WLTP 567 (2020), in 2022 herijkt naar 547 km.",
          range: { wltp: 567, ...est(567) },
        },
        {
          trim: "RWD (Highland)",
          drivetrain: "RWD",
          years: "2023+",
          batteryKwh: 60,
          range: { wltp: 513, ...est(513) },
        },
        {
          trim: "Long Range RWD (Highland)",
          drivetrain: "RWD",
          years: "2024+",
          batteryKwh: 79,
          note: "Enkele motor + grote accu — de zuinigste Model 3, langste WLTP van de reeks.",
          range: { wltp: 702, ...est(702) },
        },
      ],
    },
    {
      model: "Model Y",
      blurb:
        "RWD (LFP-accu) kwam pas eind 2022 naar de EU; 2020–2022 Model Y is in NL vrijwel altijd Long Range AWD of Performance. Juniper-facelift vanaf 2025.",
      trims: [
        {
          trim: "RWD",
          drivetrain: "RWD",
          years: "2022+ (EU)",
          batteryKwh: 57,
          note: "LFP-accu, 100% laden toegestaan. In NL nieuw vanaf begin 2023.",
          range: { wltp: 455, real: 345, winter: 290, summer: 400, highwayCold: 250, highwaySummer: 325, bron: "EV Database" },
        },
        {
          trim: "Long Range AWD",
          drivetrain: "AWD",
          years: "2021–2025",
          batteryKwh: 75,
          note: "WLTP 505 (2021) → 533 km (2022+). De meest voorkomende occasion.",
          range: { wltp: 533, real: 445, winter: 375, summer: 515, highwayCold: 320, highwaySummer: 415, bron: "EV Database" },
        },
        {
          trim: "Performance AWD",
          drivetrain: "AWD",
          years: "2021–2025",
          batteryKwh: 75,
          note: "WLTP 480 (2021) → 514 km (2022+).",
          range: { wltp: 514, ...est(514) },
        },
        {
          trim: "Long Range RWD",
          drivetrain: "RWD",
          years: "2024+",
          batteryKwh: 75,
          range: { wltp: 600, ...est(600) },
        },
      ],
    },
  ],
  "model-s": [
    {
      model: "Model S",
      blurb:
        "Altijd Dual-Motor AWD. Long Range (Raven/refresh) tegenover Performance/Plaid; de 2021-refresh en MY26 brachten flinke WLTP-sprongen.",
      trims: [
        {
          trim: "Long Range / Dual Motor",
          drivetrain: "AWD",
          years: "2019–2025",
          batteryKwh: 95,
          note: "WLTP 610 (Raven '19) → 652 ('20) → 634 (refresh '21) → 744 km (MY26 '25).",
          range: { wltp: 652, ...est(652) },
        },
        {
          trim: "Performance / Plaid",
          drivetrain: "AWD",
          years: "2019–2025",
          batteryKwh: 95,
          note: "WLTP 593 → 639; Plaid-refresh 600 (2022) → 611 km.",
          range: { wltp: 639, ...est(639) },
        },
      ],
    },
  ],
};
