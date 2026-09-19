// Trim + range reference per model. Headline (as-new) WLTP figures are the same
// curated values the scraper uses to estimate battery health (scraper/mp_tesla/
// wltp.py, sourced from EV Database). "Praktijk" (real-world) figures are EV
// Database's Real Range estimates where marked `bron: "EV Database"`; the rest are
// estimates (~0.80 × WLTP year-round, ~0.67 × WLTP in cold winter) and marked
// `bron: "schatting"`. NL real-world sits roughly between the winter and summer
// numbers; motorway (110 km/h) is the worst common case. Enyaq and Mach-E rows
// are EV Database throughout (winter = combined at -10 °C with heating).
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
  /** Which tracker listings this row covers, for the live "Aanbod" column
   *  (count + median asking price). Omitted on brands without a trim split. */
  match?: TrimMatch;
}

export interface TrimMatch {
  trim: string;
  drivetrain?: "RWD" | "AWD";
  body?: string;
  yearFrom?: number;
  yearTo?: number;
}

export interface ModelTrims {
  model: string;
  /** The listings' `model` value when it differs from the card title
   *  (Mach-E ads sit under "Mustang", Enyaq Coupé under "Enyaq"). */
  dataModel?: string;
  blurb: string;
  trims: TrimSpec[];
}

const est = (wltp: number): Pick<RangeFigures, "real" | "winter" | "summer" | "bron"> => ({
  real: Math.round(wltp * 0.8),
  winter: Math.round(wltp * 0.67),
  summer: Math.round(wltp * 0.95),
  bron: "schatting",
});

/** EV Database figures: WLTP, Real Range, combined cold/mild, motorway cold/mild. */
const evdb = (
  wltp: number, real: number, winter: number, summer: number, highwayCold: number, highwaySummer: number,
): RangeFigures => ({ wltp, real, winter, summer, highwayCold, highwaySummer, bron: "EV Database" });

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
  // Enyaq: EV Database per model year (NL spec where listed). The 2024 update
  // (MY24, on sale Oct 2023) renamed 80 → 85 with the new 286 pk motor; the MY25
  // 60 moved to a 59 kWh pack / 204 pk. Rows match the tracker's derived variant
  // and body; the facelift split for 60 and RS follows ENYAQ_FACELIFT_YEAR.
  enyaq: [
    {
      model: "Enyaq (SUV)",
      dataModel: "Enyaq",
      blurb:
        "Altijd één motor achter (RWD), behalve de x- en RS-versies (Dual-Motor AWD). Het getal is geen kWh: 50/60 = kleine accu (52–59 kWh), 80/85 = 77 kWh netto. Facelift eind 2023: 80 → 85 met sterkere, zuinigere motor.",
      trims: [
        {
          trim: "50",
          drivetrain: "RWD",
          years: "2021–2025",
          batteryKwh: 52,
          note: "Zeldzaam in NL (148–168 pk). Cijfers van de 2024-versie.",
          range: evdb(377, 305, 255, 355, 215, 280),
          match: { trim: "50", body: "SUV" },
        },
        {
          trim: "iV 60",
          drivetrain: "RWD",
          years: "2021–2023",
          batteryKwh: 58,
          note: "179 pk. De meest voorkomende occasion; MY24 (tot medio 2024) is technisch gelijk (WLTP 401 km).",
          range: evdb(413, 340, 285, 390, 240, 310),
          match: { trim: "60", body: "SUV", yearTo: 2023 },
        },
        {
          trim: "60 (facelift)",
          drivetrain: "RWD",
          years: "2024+",
          batteryKwh: 59,
          note: "Vanaf MY25: 59 kWh en 204 pk. Een 2024-bouwjaar kan nog de 58 kWh/179 pk-versie zijn (WLTP 401 km).",
          range: evdb(437, 360, 300, 415, 255, 335),
          match: { trim: "60", body: "SUV", yearFrom: 2024 },
        },
        {
          trim: "iV 80",
          drivetrain: "RWD",
          years: "2021–2023",
          batteryKwh: 77,
          note: "204 pk. Grote accu, de bereikkeuze van vóór de facelift.",
          range: evdb(548, 440, 370, 505, 315, 405),
          match: { trim: "80", body: "SUV" },
        },
        {
          trim: "iV 80x",
          drivetrain: "AWD",
          years: "2021–2023",
          batteryKwh: 77,
          note: "265 pk, Dual-Motor. In NL maar kort geleverd (nov 2021 – jul 2022).",
          range: evdb(524, 425, 360, 490, 305, 395),
          match: { trim: "80x", body: "SUV" },
        },
        {
          trim: "85",
          drivetrain: "RWD",
          years: "2023+",
          batteryKwh: 77,
          note: "286 pk, nieuwe APP550-motor. WLTP 566 km (MY24) → 586 km (MY25, praktijk 455 km).",
          range: evdb(566, 450, 380, 520, 320, 415),
          match: { trim: "85", body: "SUV" },
        },
        {
          trim: "85x",
          drivetrain: "AWD",
          years: "2023+",
          batteryKwh: 77,
          note: "286 pk, Dual-Motor. Niet nieuw in NL geleverd — alleen als import.",
          range: evdb(539, 440, 370, 505, 315, 405),
          match: { trim: "85x", body: "SUV" },
        },
        {
          trim: "iV RS",
          drivetrain: "AWD",
          years: "2022–2023",
          batteryKwh: 77,
          note: "299 pk.",
          range: evdb(517, 420, 355, 480, 300, 385),
          match: { trim: "RS", body: "SUV", yearTo: 2023 },
        },
        {
          trim: "RS (facelift)",
          drivetrain: "AWD",
          years: "2024+",
          batteryKwh: 77,
          note: "340 pk; ~25 km meer WLTP dan de iV RS.",
          range: evdb(542, 435, 365, 500, 310, 405),
          match: { trim: "RS", body: "SUV", yearFrom: 2024 },
        },
      ],
    },
    {
      model: "Enyaq Coupé",
      dataModel: "Enyaq",
      blurb:
        "Zelfde techniek als de SUV, maar de aflopende daklijn is stroomlijniger: ±10–15 km meer bereik bij dezelfde accu. De RS komt in de tracker vooral als Coupé voor.",
      trims: [
        {
          trim: "60",
          drivetrain: "RWD",
          years: "2022+",
          batteryKwh: 59,
          note: "Cijfers van de MY25-versie (204 pk); de oudere 58 kWh-Coupé ligt ~30 km lager.",
          range: evdb(446, 370, 310, 430, 265, 345),
          match: { trim: "60", body: "Coupé" },
        },
        {
          trim: "iV 80",
          drivetrain: "RWD",
          years: "2022–2023",
          batteryKwh: 77,
          note: "204 pk.",
          range: evdb(560, 445, 375, 510, 320, 410),
          match: { trim: "80", body: "Coupé" },
        },
        {
          trim: "85",
          drivetrain: "RWD",
          years: "2023+",
          batteryKwh: 77,
          note: "286 pk. De Enyaq met het grootste bereik.",
          range: evdb(577, 460, 385, 530, 330, 430),
          match: { trim: "85", body: "Coupé" },
        },
        {
          trim: "iV RS",
          drivetrain: "AWD",
          years: "2022–2023",
          batteryKwh: 77,
          note: "299 pk.",
          range: evdb(523, 430, 360, 490, 310, 395),
          match: { trim: "RS", body: "Coupé", yearTo: 2023 },
        },
        {
          trim: "RS (facelift)",
          drivetrain: "AWD",
          years: "2024+",
          batteryKwh: 77,
          note: "340 pk.",
          range: evdb(548, 445, 370, 515, 320, 420),
          match: { trim: "RS", body: "Coupé", yearFrom: 2024 },
        },
      ],
    },
  ],
  // Mach-E: EV Database, NL spec. Ford enlarged both packs for MY22/MY23
  // (88 → 91 kWh Extended, 68 → 72.6 kWh Standard late 2023); rows carry the
  // figures of the most common occasion year and note the other.
  "mach-e": [
    {
      model: "Mustang Mach-E",
      dataModel: "Mustang",
      blurb:
        "Standard Range (68–73 kWh) of Extended Range (88–91 kWh), elk met RWD of AWD. GT en Rally zijn altijd Extended Range AWD met ~487 pk. Extended Range RWD is de bereikkampioen.",
      trims: [
        {
          trim: "Standard Range RWD",
          drivetrain: "RWD",
          years: "2021+",
          batteryKwh: 68,
          note: "269 pk. Vanaf eind 2023 72,6 kWh: WLTP 470 km, praktijk 380 km.",
          range: evdb(440, 365, 310, 420, 260, 330),
          match: { trim: "Standard Range", drivetrain: "RWD" },
        },
        {
          trim: "Standard Range AWD",
          drivetrain: "AWD",
          years: "2021+",
          batteryKwh: 73,
          note: "269–315 pk. Cijfers van de 72,6 kWh-versie (eind 2023+); de 68 kWh-versie haalt WLTP ~400 km.",
          range: evdb(428, 350, 300, 400, 250, 320),
          match: { trim: "Standard Range", drivetrain: "AWD" },
        },
        {
          trim: "Extended Range RWD",
          drivetrain: "RWD",
          years: "2021+",
          batteryKwh: 88,
          note: "294 pk. WLTP 610 km (88 kWh, 2021) → 600 km (91 kWh, eind 2022+, praktijk 480 km).",
          range: evdb(610, 465, 395, 530, 330, 425),
          match: { trim: "Extended Range", drivetrain: "RWD" },
        },
        {
          trim: "Extended Range AWD",
          drivetrain: "AWD",
          years: "2021+",
          batteryKwh: 88,
          note: "351 pk. 91 kWh-accu vanaf MY22 (praktijk 440 km).",
          range: evdb(540, 430, 365, 485, 305, 390),
          match: { trim: "Extended Range", drivetrain: "AWD" },
        },
        {
          trim: "GT",
          drivetrain: "AWD",
          years: "2021+",
          batteryKwh: 88,
          note: "487 pk, MagneRide. WLTP 500 km (2021) → 515 km (MY25, praktijk 435 km).",
          range: evdb(500, 410, 350, 465, 295, 375),
          match: { trim: "GT" },
        },
        {
          trim: "Rally",
          drivetrain: "AWD",
          years: "2024+",
          batteryKwh: 91,
          note: "487 pk, verhoogd onderstel en offroad-banden.",
          range: evdb(510, 410, 350, 460, 295, 370),
          match: { trim: "Rally" },
        },
      ],
    },
  ],
};

/** Brands with a trim/range guide get the "Uitvoeringen" tab. */
export function hasTrimGuide(brand: BrandKey): boolean {
  return TRIM_GUIDE[brand] != null;
}
