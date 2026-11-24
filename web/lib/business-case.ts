// Business case (/businesscase): total cost of ownership for the shortlisted
// cars near Rotterdam vs. keeping the current (damaged, 272k km) Skoda.
//
// Static assumptions researched 2026-11-04. Insurance and maintenance are
// estimates, not quotes. Depreciation is fitted on each tracker's live listings
// as a percentage per year of age and per km (log-price regression), so it
// follows the market and a cheap car loses fewer euros than an expensive one.

import type { BrandKey } from "./brands";
import type { Listing } from "./types";

export interface BcVehicle {
  /** Same id as in COMPARE_VEHICLES, whose `match` picks the listings (unless `match` is set). */
  compareId: string;
  /** Own listing filter, for variants /vergelijk doesn't have (Octavia iV). */
  match?: (l: Listing) => boolean;
  name: string;
  dataset: BrandKey;
  /** Key in dataset.models whose regression gives the depreciation. */
  modelKey: string;
  kind: "ev" | "phev" | "ice";
  /** Premium audio required for a pick (ID.4 / Niro EV: Harman Kardon is too rare, so not). */
  requireAudio: boolean;
  /** Tow hitch required: EVs only, for a tow-bar box (a roof box costs EV range).
   *  The Skodas can carry a roof box instead. */
  requireTow: boolean;
  /** How many live listings to show. */
  picks: number;
  /** Average consumption over the year, battery side (kWh/100 km), from the real
   *  summer/winter range on /vergelijk. PHEV: in electric mode. */
  kwhPer100: number;
  /** Petrol (l/100 km): PHEV with an empty battery, or the petrol car. */
  litersPer100?: number;
  /** Where it can fast-charge: Tesla price, Supercharger with/without subscription, or not at all. */
  fastCharge: "tesla" | "other" | "none";
  /** Empty mass (RDW "massa ledig voertuig", approx.) for road tax. */
  massKg: number;
  /** Insurance €/month, Zuid-Holland 3051, 7 claim-free years. EVs: the €165/month
   *  quote for the Hosni Model Y, used for all EVs. Skodas: estimate. */
  insurance: { allrisk: number; waPlus: number };
  /** Servicing, APK, wipers, brake fluid etc. per year, excl. tyres, for a car
   *  around MAINT_REF_KM; it rises with the odometer (see maintenanceFactor). */
  maintenancePerYear: number;
  /** Tyre wear, €/km (set price / life). */
  tyresPerKm: number;
  /** HV battery warranty: years from first registration and km. None for petrol. */
  batteryWarranty?: { years: number; km: number };
  roadsideNote: string;
  notes: string;
}

export const BC_VEHICLES: BcVehicle[] = [
  {
    compareId: "tesla-y-lr", name: "Model Y LR AWD", dataset: "tesla", modelKey: "Model Y",
    kind: "ev", requireAudio: true, requireTow: true, picks: 2, kwhPer100: 17.3, fastCharge: "tesla", massKg: 1909,
    insurance: { allrisk: 165, waPlus: 115 },
    maintenancePerYear: 250, tyresPerKm: 0.028,
    batteryWarranty: { years: 8, km: 192_000 },
    roadsideNote: "Tesla Roadside alleen binnen de basisgarantie (4 jaar / 80.000 km)",
    notes: "Banden slijten sneller (gewicht + koppel); 19\" set ~€1.000 per ~35.000 km. Geen olie, nauwelijks remslijtage.",
  },
  {
    compareId: "superb-iv", name: "Superb Combi iV", dataset: "skoda", modelKey: "Superb",
    kind: "phev", requireAudio: true, requireTow: false, picks: 2, kwhPer100: 18.5, litersPer100: 6.5, fastCharge: "none", massKg: 1710,
    insurance: { allrisk: 120, waPlus: 85 },
    maintenancePerYear: 700, tyresPerKm: 0.017,
    batteryWarranty: { years: 8, km: 160_000 },
    roadsideNote: "Skoda Mobiliteitsgarantie verlengt bij onderhoud bij de dealer",
    notes: "Jaarlijkse olie-beurt, DSG-olie elke 60.000 km (~€350), bougies, remmen. Twee aandrijflijnen = meer kans op reparaties. Laadt alleen AC 3,6 kW.",
  },
  {
    compareId: "mach-e-er", name: "Mach-E ER RWD", dataset: "mach-e", modelKey: "Mustang",
    kind: "ev", requireAudio: true, requireTow: true, picks: 2, kwhPer100: 19.4, fastCharge: "other", massKg: 1993,
    insurance: { allrisk: 165, waPlus: 115 },
    maintenancePerYear: 350, tyresPerKm: 0.025,
    batteryWarranty: { years: 8, km: 160_000 },
    roadsideNote: "Ford Assistance verlengt bij onderhoud bij de dealer",
    notes: "Onderhoud elke 2 jaar / 30.000 km. Check recall 22S41 (HV-hoofdrelais) en de 12V-accu.",
  },
  {
    compareId: "enyaq-80", name: "Enyaq iV 80", dataset: "enyaq", modelKey: "Enyaq",
    // Canton + tow hitch: none within 40 km, so picks on tow hitch only (Canton flagged per car).
    kind: "ev", requireAudio: false, requireTow: true, picks: 2, kwhPer100: 18.0, fastCharge: "other", massKg: 1990,
    insurance: { allrisk: 165, waPlus: 115 },
    maintenancePerYear: 350, tyresPerKm: 0.023,
    batteryWarranty: { years: 8, km: 160_000 },
    roadsideNote: "Skoda Mobiliteitsgarantie verlengt bij onderhoud bij de dealer",
    notes: "Grootste kofferbak van de EV's na de Model Y (585 L). Laadt 125 kW tot bouw jan 2022, daarna 135 kW. Onderhoud elke 2 jaar / 30.000 km.",
  },
  {
    compareId: "id4-pro", name: "ID.4 Pro 77 kWh", dataset: "id4", modelKey: "ID.4",
    kind: "ev", requireAudio: false, requireTow: true, picks: 2, kwhPer100: 19.2, fastCharge: "other", massKg: 2050,
    insurance: { allrisk: 165, waPlus: 115 },
    maintenancePerYear: 350, tyresPerKm: 0.023,
    batteryWarranty: { years: 8, km: 160_000 },
    roadsideNote: "VW Mobiliteitsgarantie verlengt bij onderhoud bij de dealer",
    notes: "Harman Kardon is zeldzaam, dus picks alleen op trekhaak. Onderhoud elke 2 jaar / 30.000 km.",
  },
  {
    compareId: "e-niro-64", name: "e-Niro 64 kWh", dataset: "niro", modelKey: "Niro",
    // massKg: EV Database EU kerb weight (incl. 75 kg driver) minus the driver.
    kind: "ev", requireAudio: true, requireTow: true, picks: 2, kwhPer100: 17.6, fastCharge: "other", massKg: 1737,
    insurance: { allrisk: 165, waPlus: 115 },
    maintenancePerYear: 300, tyresPerKm: 0.017,
    // Kia Tot 10 Jaar Garantie: 10 years / 150,000 km while it is serviced yearly at
    // a Kia dealer (the maintenance budget assumes that); otherwise 7 years.
    batteryWarranty: { years: 10, km: 150_000 },
    roadsideNote: "Kia-pechhulp: check bij de dealer of die nog loopt (gekoppeld aan onderhoud)",
    notes: "JBL zit alleen op de ExecutiveLine. Kleinste kofferbak (451 L); trekhaak alleen voor fietsendrager of trekhaakkoffer (100 kg kogeldruk vanaf MY21). Garantie 10 jaar bij jaarlijks Kia-dealeronderhoud, anders 7. Check de BMS-recall (bouw mei 2020 – mrt 2022).",
  },
  {
    compareId: "niro-ev", name: "Niro EV 64,8 kWh", dataset: "niro", modelKey: "Niro",
    // Harman Kardon (ExecutiveLine / Plus Advanced only) is too rare, so picks on tow hitch only.
    kind: "ev", requireAudio: false, requireTow: true, picks: 1, kwhPer100: 17.3, fastCharge: "other", massKg: 1682,
    insurance: { allrisk: 165, waPlus: 115 },
    maintenancePerYear: 300, tyresPerKm: 0.017,
    batteryWarranty: { years: 10, km: 150_000 },
    roadsideNote: "Kia-pechhulp: check bij de dealer of die nog loopt (gekoppeld aan onderhoud)",
    notes: "Tweede generatie: 475 L + 20 L frunk, 750 kg trekgewicht, 11 kW 3-fase standaard. Harman Kardon alleen op ExecutiveLine / Plus Advanced. Garantie 10 jaar bij jaarlijks Kia-dealeronderhoud, anders 7.",
  },
  {
    compareId: "octavia-combi", name: "Octavia Combi 1.0/1.5 TSI", dataset: "skoda", modelKey: "Octavia",
    match: (l) => l.model === "Octavia" && l.body === "Stationwagon" && l.year != null && l.year >= 2020 && l.year <= 2024
      && (l.power_hp ?? 0) <= 150 && l.fuel !== "Diesel" && !/\biv\b|phev|plug/i.test(l.title ?? ""),
    kind: "ice", requireAudio: false, requireTow: false, picks: 1, kwhPer100: 0, litersPer100: 5.8, fastCharge: "none", massKg: 1330,
    insurance: { allrisk: 105, waPlus: 75 },
    maintenancePerYear: 500, tyresPerKm: 0.014,
    roadsideNote: "Skoda Mobiliteitsgarantie verlengt bij onderhoud bij de dealer",
    notes: "Simpelste optie: 1.0 e-TSI (110 pk, 48V mild hybrid) of 1.5 TSI (150 pk). Dakkoffer i.p.v. trekhaak. DSG-olie elke 60.000 km.",
  },
  {
    compareId: "octavia-iv", name: "Octavia Combi iV", dataset: "skoda", modelKey: "Octavia",
    // Real plug-ins only: the tracker labels the 1.0 e-TSI / 1.5 e-TEC mild hybrids as PHEV too. RS iV left out (sporty, pricier).
    match: (l) => l.model === "Octavia" && l.body === "Stationwagon" && l.year != null && l.year >= 2020 && l.year <= 2024
      && /\biv\b|phev|plug-?in/i.test(l.title ?? "") && !/\brs\b|e-?tec|e-?tsi|mild/i.test(l.title ?? ""),
    kind: "phev", requireAudio: false, requireTow: false, picks: 1, kwhPer100: 16.5, litersPer100: 5.8, fastCharge: "none", massKg: 1560,
    insurance: { allrisk: 110, waPlus: 80 },
    maintenancePerYear: 650, tyresPerKm: 0.015,
    batteryWarranty: { years: 8, km: 160_000 },
    roadsideNote: "Skoda Mobiliteitsgarantie verlengt bij onderhoud bij de dealer",
    notes: "Zelfde 1.4 TSI iV-aandrijving als de Superb (13 kWh, ~50 km elektrisch, AC 3,6 kW). Kofferbak 490 L (benzine-Combi 640 L).",
  },
];

/** Picks: only dealers/sellers within this distance of Rotterdam (3051). */
export const BC_MAX_DISTANCE_KM = 40;

/** How energy prices move from today's (2026) prices over the ownership period.
 *  "vlak" = today's prices for every year (the old model). */
export type PriceScenario = "vlak" | "laag" | "midden" | "hoog";

export interface PricePathYear {
  year: number;
  /** Change vs. 2026, €/l incl. VAT, 2026 prices (no inflation). */
  petrol: number;
  /** Change vs. 2026, €/kWh incl. VAT at the street pole. */
  street: number;
  /** Change vs. 2026, €/kWh incl. VAT at the Supercharger (Tesla and non-Tesla). */
  sc: number;
}

// Energy prices 2027–2035, researched 2026-11-24. All deltas vs. 2026, incl. 21% VAT,
// in 2026 euros (real), like the rest of the model (road tax, insurance, maintenance
// are not indexed either). Adding ~2% inflation a year gives the pump/pole price.
//
// Petrol = excise + ETS2 + RED III (crude oil itself: flat; it swings ±€0.30 a year):
// - Excise 2026 €0.845/l. The 2022 discount is extended to 2027 (€0.85), partly phased
//   out in 2028 (€0.95) and gone in 2029 (≈€1.00/l in 2026 prices; PBL tabel 3.1).
//   Incl. VAT: +€0.08 in 2028, +€0.19 from 2029. Laag: the discount is extended again.
// - ETS2 starts 2028. PBL: €0.00237/l per €/t CO2 excl. VAT (€0.14/0.20/0.32 at
//   €57/86/135 per tonne). Laag 45→57 €/t (MSR price brake, continued after 2030);
//   midden = KEV 2026 (71 €/t in 2028 +10%/yr → 86 in 2030); hoog 100 → 135 in 2030 → 220 in 2035.
// - RED III biofuel obligation: the government expects petrol 1–3 ct/l (excl. VAT) cheaper
//   by 2030 (E10 is already near its blend limit; the extra blending lands on diesel), the
//   4th RED III progress letter 4–6 ct/l more for road fuel. Laag −€0.02, midden 0, hoog +€0.06.
//
// Street pole (€0.38 excl. VAT now) = power + energy tax + grid + operator margin:
// - Power: KEV 2026 supply price €0.12 (2026) → €0.10 (2027) → €0.09/kWh (2028+).
//   Laag passes it on in full, midden half (pole tariffs move slowly), hoog not at all.
// - Energy tax (Belastingplan 2026): €0.089 → 0.083 → 0.079 → 0.075 → 0.076 (2030),
//   then flat. Hoog: the cut is reversed.
// - Grid: a 3×25 A pole pays the household capacity tariff, ~€400/yr excl. VAT over
//   ~15 MWh ≈ €0.027/kWh; +15% in 2027 (ACM), then +7.5%/yr real (FIEN 2026).
// - Time-of-use grid tariffs for connections ≤3×80 A from 2029 (Netbeheer Nederland /
//   ACM): 2/3 of the transport cost per kWh, peak 16–21h. A pole that charges in
//   the evening then pays ~€0.11/kWh excl. VAT instead of ~€0.04 (own estimate from
//   CE Delft's 2030 grid tariffs; no source covers public poles yet). Hoog: in full
//   from 2029. Midden: half of it from 2030 (start slips, smart charging at night). Laag: none.
// Supercharger (large connection, no time-of-use grid tariff): power as for the pole,
// and a grid share of ~€0.05/kWh growing like the pole's capacity tariff.
export const PRICE_PATHS: Record<Exclude<PriceScenario, "vlak">, PricePathYear[]> = {
  laag: [
    { year: 2027, petrol: 0, street: -0.027, sc: -0.015 },
    { year: 2028, petrol: 0.12, street: -0.041, sc: -0.022 },
    { year: 2029, petrol: 0.13, street: -0.042, sc: -0.016 },
    { year: 2030, petrol: 0.14, street: -0.038, sc: -0.01 },
    { year: 2031, petrol: 0.14, street: -0.034, sc: -0.004 },
    { year: 2032, petrol: 0.14, street: -0.031, sc: 0.003 },
    { year: 2033, petrol: 0.14, street: -0.027, sc: 0.011 },
    { year: 2034, petrol: 0.14, street: -0.022, sc: 0.019 },
    { year: 2035, petrol: 0.14, street: -0.018, sc: 0.027 },
  ],
  midden: [
    { year: 2027, petrol: 0, street: -0.014, sc: -0.003 },
    { year: 2028, petrol: 0.28, street: -0.023, sc: -0.004 },
    { year: 2029, petrol: 0.41, street: -0.024, sc: 0.002 },
    { year: 2030, petrol: 0.44, street: 0.027, sc: 0.008 },
    { year: 2031, petrol: 0.46, street: 0.034, sc: 0.014 },
    { year: 2032, petrol: 0.49, street: 0.042, sc: 0.021 },
    { year: 2033, petrol: 0.52, street: 0.049, sc: 0.029 },
    { year: 2034, petrol: 0.55, street: 0.059, sc: 0.037 },
    { year: 2035, petrol: 0.59, street: 0.068, sc: 0.045 },
  ],
  hoog: [
    { year: 2027, petrol: 0.02, street: 0.005, sc: 0.009 },
    { year: 2028, petrol: 0.51, street: 0.008, sc: 0.014 },
    { year: 2029, petrol: 0.57, street: 0.099, sc: 0.02 },
    { year: 2030, petrol: 0.64, street: 0.108, sc: 0.026 },
    { year: 2031, petrol: 0.68, street: 0.119, sc: 0.032 },
    { year: 2032, petrol: 0.72, street: 0.13, sc: 0.039 },
    { year: 2033, petrol: 0.77, street: 0.143, sc: 0.047 },
    { year: 2034, petrol: 0.82, street: 0.155, sc: 0.055 },
    { year: 2035, petrol: 0.88, street: 0.17, sc: 0.064 },
  ],
};

export const PRICE_SCENARIOS: { key: PriceScenario; label: string; hint: string }[] = [
  { key: "vlak", label: "Huidige tarieven", hint: "de prijzen van nu, elk jaar gelijk" },
  { key: "midden", label: "Verwachte tarieven t/m 2035", hint: "accijnskorting weg in 2029, ETS2 volgens de KEV (86 €/t in 2030), half tijdsafhankelijk nettarief vanaf 2030" },
  { key: "laag", label: "Verwacht, laag", hint: "accijnskorting blijft, CO₂-prijs ETS2 laag (~57 €/t), stroom volgt de KEV-daling" },
  { key: "hoog", label: "Verwacht, hoog", hint: "accijnskorting weg in 2028, ETS2 hoog (135 €/t in 2030), geen stroomdaling, volledig tijdsafhankelijk nettarief vanaf 2029" },
];

/** The two choices on the page; laag/hoog only show the range. */
export const PRICE_BUTTONS: PriceScenario[] = ["vlak", "midden"];

/** Last year with a forecast. */
export const PRICE_PATH_END = 2035;

/** Assumed inflation, only to show what the real prices mean at the pump. */
export const INFLATION_PCT = 2;

/** Price change vs. 2026 for a calendar year (before 2027: none; after 2035: as 2035). */
export function priceDelta(scenario: PriceScenario, year: number): Omit<PricePathYear, "year"> {
  if (scenario === "vlak" || year < 2027) return { petrol: 0, street: 0, sc: 0 };
  const path = PRICE_PATHS[scenario];
  const p = path.find((x) => x.year === year) ?? path[path.length - 1];
  return { petrol: p.petrol, street: p.street, sc: p.sc };
}

/** The inputs with that year's energy prices filled in. */
export function pricesInYear(i: BcInputs, year: number): BcInputs {
  const d = priceDelta(i.priceScenario, year);
  return {
    ...i,
    petrolEur: i.petrolEur + d.petrol,
    streetKwhEur: i.streetKwhEur + d.street,
    scOffpeakKwhEur: i.scOffpeakKwhEur + d.sc,
    scNonTeslaKwhEur: i.scNonTeslaKwhEur + d.sc,
  };
}

/** Calendar years of the ownership period. */
export const periodYears = (i: BcInputs) => Array.from({ length: i.years }, (_, y) => i.startYear + y);

export interface BcInputs {
  kmPerYear: number;
  years: number;
  /** Energy price path from today's prices (see PRICE_PATHS). */
  priceScenario: PriceScenario;
  /** Today's (2026) petrol price; later years follow priceScenario. */
  petrolEur: number;
  /** Equans street pole near Robijnstraat, incl. VAT and a typical card markup (2026). */
  streetKwhEur: number;
  /** Supercharger off-peak (22–08), Tesla price / non-Tesla with subscription. */
  scOffpeakKwhEur: number;
  /** Supercharger for non-Teslas without subscription. */
  scNonTeslaKwhEur: number;
  scSubscriptionPerYear: number;
  /** Share of kWh charged at a Supercharger (rest at the street pole). */
  fastSharePct: number;
  /** PHEVs (Superb iV, Octavia iV): share of km driven electrically. */
  phevElectricPct: number;
  /** Insurance €/month per vehicle (keyed by compareId); presets from `insurance`. */
  insurance: Record<string, number>;
  /** Opportunity cost: savings rate on the money tied up in the car. */
  interestPct: number;
  roadsidePerYear: number;
  /** Charging from the home solar panels while the car is parked (summer weekdays). */
  solar: {
    enabled: boolean;
    /** Yearly generation (kWh). Spread over the months with SOLAR_PROFILE. */
    yearKwh: number;
    /** Share of each month's generation that can go into the car: not used by the
     *  house, sun out while the car is home and plugged in, above the 1.4 kW minimum. */
    availablePct: number;
    /** Share of the car's normal (non-fast) charging that can happen at home at all;
     *  the rest happens away from home or when the battery is already full. */
    maxHomePct: number;
    /** What a solar kWh is worth when fed back instead (no net metering from 2027). */
    feedInEur: number;
  };
  /** First calendar year of ownership (road-tax discount steps by year). */
  startYear: number;
  current: {
    residualEur: number;
    repairEur: number;
    maintenancePerYear: number;
    insuranceMonthly: number;
    roadTaxMonthly: number;
    litersPer100: number;
  };
}

export const BC_DEFAULTS: BcInputs = {
  kmPerYear: 14_000,
  years: 4,
  priceScenario: "midden",
  petrolEur: 2.3,
  streetKwhEur: 0.46,
  scOffpeakKwhEur: 0.3,
  scNonTeslaKwhEur: 0.5,
  scSubscriptionPerYear: 156,
  fastSharePct: 30,
  phevElectricPct: 50,
  insurance: Object.fromEntries(BC_VEHICLES.map((v) => [v.compareId, v.insurance.allrisk])),
  interestPct: 2,
  roadsidePerYear: 100,
  solar: { enabled: true, yearKwh: 2500, availablePct: 40, maxHomePct: 70, feedInEur: 0.05 },
  startYear: 2027,
  current: {
    residualEur: 1500,
    repairEur: 1500,
    maintenancePerYear: 1500,
    insuranceMonthly: 110,
    roadTaxMonthly: 60,
    litersPer100: 6.5,
  },
};

const AC_LOSS = 1.1; // 11 kW three-phase street pole
const PHEV_AC_LOSS = 1.12; // 3.6 kW single phase
const DC_LOSS = 1.05;

/** Road tax Zuid-Holland (104.4 opcenten), petrol rate per quarter, 2026 prices.
 *  Fitted to the published EV table (70%): 1,500 kg €173 … 2,000 kg €276. */
export function roadTaxFullPerQuarter(massKg: number): number {
  return Math.max(60, (173 + (massKg - 1500) * 0.206) / 0.7);
}
/** EVs pay 70% through 2028, 75% in 2029 and the full rate from 2030. PHEVs pay the full rate. */
export function evRoadTaxFactor(year: number): number {
  return year <= 2028 ? 0.7 : year === 2029 ? 0.75 : 1;
}

export interface Depreciation {
  /** ln(price) change per extra year of age (negative). */
  logPerYear: number;
  /** ln(price) change per extra km (negative). */
  logPerKm: number;
  /** Listings the fit used, and its R² (incl. the segment dummies). */
  n: number;
  r2: number;
}

/** Share of the value lost per year of age, and per 10,000 km (for display). */
export const depPctPerYear = (d: Depreciation) => 1 - Math.exp(d.logPerYear);
export const depPctPer10kKm = (d: Depreciation) => 1 - Math.exp(d.logPerKm * 10_000);

interface DepListing {
  year: number | null; mileage_km: number | null; price_eur: number | null;
  trim?: string | null; fuel?: string | null; is_juniper?: boolean | null; drivetrain?: string | null;
}

/** Fit ln(price) = segment + b·age + c·km on a model's live used listings. Segments
 *  (trim × fuel × Juniper × drivetrain, ≥10 cars each) get their own intercept so
 *  the age/km slopes aren't confounded by the trim mix. Null when there's too little data. */
export function fitDepreciation(listings: DepListing[], refYear: number): Depreciation | null {
  const seg = (l: DepListing) => `${l.trim}|${l.fuel}|${l.is_juniper}|${l.drivetrain}`;
  const rows = listings.filter((l) => l.year != null && l.mileage_km != null && l.price_eur != null);
  const counts = new Map<string, number>();
  for (const l of rows) counts.set(seg(l), (counts.get(seg(l)) ?? 0) + 1);
  const segs = [...counts].filter(([, c]) => c >= 10).map(([s]) => s);
  const data = rows.filter((l) => segs.includes(seg(l)));
  if (data.length < 30) return null;
  const k = segs.length + 2;
  const xs = data.map((l) => [...segs.map((s) => (seg(l) === s ? 1 : 0)), refYear - l.year!, l.mileage_km! / 1000]);
  const ys = data.map((l) => Math.log(l.price_eur!));
  // Normal equations (X'X) b = X'y, solved by Gaussian elimination with pivoting.
  const a = Array.from({ length: k }, (_, r) => [
    ...Array.from({ length: k }, (_, c) => xs.reduce((sum, x) => sum + x[r] * x[c], 0)),
    xs.reduce((sum, x, idx) => sum + x[r] * ys[idx], 0),
  ]);
  for (let col = 0; col < k; col++) {
    let piv = col;
    for (let r = col + 1; r < k; r++) if (Math.abs(a[r][col]) > Math.abs(a[piv][col])) piv = r;
    if (Math.abs(a[piv][col]) < 1e-9) return null;
    [a[col], a[piv]] = [a[piv], a[col]];
    for (let r = 0; r < k; r++) {
      if (r === col) continue;
      const f = a[r][col] / a[col][col];
      for (let c = col; c <= k; c++) a[r][c] -= f * a[col][c];
    }
  }
  const b = a.map((row, r) => row[k] / row[r]);
  const mean = ys.reduce((x, y) => x + y, 0) / ys.length;
  let ssRes = 0;
  let ssTot = 0;
  xs.forEach((x, idx) => {
    const pred = x.reduce((sum, v, c) => sum + v * b[c], 0);
    ssRes += (ys[idx] - pred) ** 2;
    ssTot += (ys[idx] - mean) ** 2;
  });
  const logPerYear = b[k - 2];
  const logPerKm = b[k - 1] / 1000;
  if (!(logPerYear < 0 && logPerKm < 0)) return null;
  return { logPerYear, logPerKm, n: data.length, r2: 1 - ssRes / ssTot };
}

/** Maintenance budgets are set for a car around this odometer reading. */
export const MAINT_REF_KM = 100_000;
/** Extra maintenance per 100,000 km above (or below, down to −20%) the reference:
 *  petrol/PHEV wear (clutch/DSG, exhaust, two drive systems) far more than an EV. */
export const MAINT_GROWTH_PER_100K: Record<BcVehicle["kind"], number> = { ev: 0.25, phev: 0.6, ice: 0.5 };
export function maintenanceFactor(kind: BcVehicle["kind"], odometerKm: number): number {
  return Math.max(0.8, 1 + MAINT_GROWTH_PER_100K[kind] * (odometerKm - MAINT_REF_KM) / 100_000);
}

export interface CostBreakdown {
  purchase: number;
  residualEnd: number;
  depreciation: number;
  repair: number;
  energy: number;
  roadTax: number;
  insurance: number;
  maintenance: number;
  roadside: number;
  interest: number;
  total: number;
  perMonth: number;
}

function finish(c: Omit<CostBreakdown, "total" | "perMonth">, years: number): CostBreakdown {
  const total = c.depreciation + c.repair + c.energy + c.roadTax + c.insurance + c.maintenance + c.roadside + c.interest;
  return { ...c, total, perMonth: total / (years * 12) };
}

/** Monthly generation shape, Jan–Dec (NL; peak ~350, worst ~50 kWh at 2.5 MWh/yr). */
export const SOLAR_PROFILE = [55, 110, 190, 280, 340, 350, 345, 290, 220, 150, 70, 50];
const SOLAR_PROFILE_SUM = SOLAR_PROFILE.reduce((a, b) => a + b, 0);

/** kWh per month from the panels into the car (drawn from the wall, incl. losses),
 *  given the car's yearly AC charging need at the wall. */
export function solarToCar(acDrawnPerYear: number, i: BcInputs): number[] {
  if (!i.solar.enabled) return SOLAR_PROFILE.map(() => 0);
  const needPerMonth = (acDrawnPerYear / 12) * (i.solar.maxHomePct / 100);
  return SOLAR_PROFILE.map((w) =>
    Math.min((w / SOLAR_PROFILE_SUM) * i.solar.yearKwh * (i.solar.availablePct / 100), needPerMonth));
}

export interface EnergySplit {
  total: number;
  /** kWh per year from the panels (at the wall). */
  solarKwh: number;
  /** What those kWh would have cost at the street pole, minus the lost feed-in. */
  solarSaving: number;
}

export function energySplit(v: BcVehicle, i: BcInputs): EnergySplit {
  const k = i.kmPerYear / 100;
  if (v.kind === "ice") return { total: k * (v.litersPer100 ?? 6) * i.petrolEur, solarKwh: 0, solarSaving: 0 };
  const street = (drawn: number) => {
    const solarKwh = solarToCar(drawn, i).reduce((a, b) => a + b, 0);
    return {
      cost: (drawn - solarKwh) * i.streetKwhEur + solarKwh * i.solar.feedInEur,
      solarKwh,
      solarSaving: solarKwh * (i.streetKwhEur - i.solar.feedInEur),
    };
  };
  if (v.kind === "phev") {
    const e = i.phevElectricPct / 100;
    const ac = street(k * e * v.kwhPer100 * PHEV_AC_LOSS);
    return { total: ac.cost + k * (1 - e) * (v.litersPer100 ?? 6.5) * i.petrolEur, solarKwh: ac.solarKwh, solarSaving: ac.solarSaving };
  }
  const kwh = k * v.kwhPer100;
  const f = v.fastCharge === "none" ? 0 : i.fastSharePct / 100;
  const acPart = street(kwh * (1 - f) * AC_LOSS);
  const ac = acPart.cost;
  const dcKwh = kwh * f * DC_LOSS;
  const dc = v.fastCharge === "tesla"
    ? dcKwh * i.scOffpeakKwhEur
    : f === 0 ? 0 : Math.min(dcKwh * i.scNonTeslaKwhEur, dcKwh * i.scOffpeakKwhEur + i.scSubscriptionPerYear);
  return { total: ac + dc, solarKwh: acPart.solarKwh, solarSaving: acPart.solarSaving };
}

export function energyPerYear(v: BcVehicle, i: BcInputs): number {
  return energySplit(v, i).total;
}

/** Energy over the whole period, each year at that year's prices. */
export function energyOverPeriod(v: BcVehicle, i: BcInputs): number {
  return periodYears(i).reduce((sum, y) => sum + energyPerYear(v, pricesInYear(i, y)), 0);
}

/** Petrol for the current Skoda over the whole period. */
export function currentEnergyOverPeriod(i: BcInputs): number {
  return periodYears(i).reduce((sum, y) => sum + (i.kmPerYear / 100) * i.current.litersPer100 * pricesInYear(i, y).petrolEur, 0);
}

export function vehicleCost(v: BcVehicle, priceEur: number, startKm: number, dep: Depreciation, i: BcInputs): CostBreakdown {
  const n = i.years;
  const residualEnd = priceEur * Math.exp(n * (dep.logPerYear + i.kmPerYear * dep.logPerKm));
  let maintenance = 0;
  for (let y = 0; y < n; y++) {
    const odo = startKm + (y + 0.5) * i.kmPerYear;
    maintenance += v.maintenancePerYear * maintenanceFactor(v.kind, odo) + v.tyresPerKm * i.kmPerYear;
  }
  let roadTax = 0;
  for (let y = 0; y < n; y++) {
    const factor = v.kind === "ev" ? evRoadTaxFactor(i.startYear + y) : 1;
    roadTax += roadTaxFullPerQuarter(v.massKg) * 4 * factor;
  }
  return finish({
    purchase: priceEur,
    residualEnd,
    depreciation: priceEur - residualEnd,
    repair: 0,
    energy: energyOverPeriod(v, i),
    roadTax,
    insurance: (i.insurance[v.compareId] ?? v.insurance.allrisk) * 12 * n,
    maintenance,
    roadside: i.roadsidePerYear * n,
    interest: ((priceEur + residualEnd) / 2) * (i.interestPct / 100) * n,
  }, n);
}

/** Keep the current Skoda: repair it once, then run it until it's worth nothing.
 *  Its maintenance budget is for today (272,000 km) and grows like a petrol car's. */
export function currentCarCost(i: BcInputs): CostBreakdown {
  const c = i.current;
  const n = i.years;
  let maintenance = 0;
  for (let y = 0; y < n; y++) {
    maintenance += c.maintenancePerYear * (1 + MAINT_GROWTH_PER_100K.ice * ((y + 0.5) * i.kmPerYear) / 100_000);
  }
  return finish({
    purchase: c.residualEur,
    residualEnd: 0,
    depreciation: c.residualEur,
    repair: c.repairEur,
    energy: currentEnergyOverPeriod(i),
    roadTax: c.roadTaxMonthly * 12 * n,
    insurance: c.insuranceMonthly * 12 * n,
    maintenance,
    roadside: i.roadsidePerYear * n,
    interest: (c.residualEur / 2) * (i.interestPct / 100) * n,
  }, n);
}

export const PRICE_SOURCES: { label: string; url: string }[] = [
  { label: "TNO – Prognose energierekening huishoudens 2026–2031 (KEV 2026-prijzen, netkosten FIEN 2026), sept. 2026", url: "https://open.overheid.nl/overheid/openbaarmakingen/api/v0/attachment/a23071ba-774e-49f1-adb8-db3d5833d2f5" },
  { label: "CE Delft – Beheersbare energiekosten voor huishoudens in 2030 (energiebelasting, nettarieven +7,5%/jr, tijdsafhankelijk nettarief)", url: "https://ce.nl/wp-content/uploads/2026/09/CE_Delft_260266_Beheersbare_energiekosten_voor_huishoudens_in_2030_Def.pdf" },
  { label: "Netbeheer Nederland – Nettarieven 2027 stijgen", url: "https://www.netbeheernederland.nl/artikelen/nieuws/nettarieven-2027-stijgen-maar-slimme-keuzes-kunnen-stijging-remmen" },
  { label: "Solar Magazine – Tijdsafhankelijke nettarieven consumenten vanaf 2029", url: "https://solarmagazine.nl/nieuws-zonne-energie/i43666/tijdsafhankelijke-nettarieven-consumenten-in-2029-van-start-prijs-verschilt-per-seizoen" },
  { label: "PBL – Het ETS2 en de gevolgen voor huishoudens (start 2028, 57–135 €/t, €0,14–0,32/l benzine excl. btw), mei 2026", url: "https://www.pbl.nl/system/files/document/2026-05/pbl-2026-ets2-en-de-gevolgen-voor-huishoudens-5921.pdf" },
  { label: "PwC – Belastingplan 2027: benzineaccijns €0,85 (2027), €0,95 (2028), korting weg per 2029", url: "https://www.pwc.nl/nl/belastingplan/fiscale-maatregelen.html" },
  { label: "Tweede Kamer – Analyse brandstofaccijns en pompprijzen (RED III: benzine 1–3 ct/l goedkoper in 2030)", url: "https://www.tweedekamer.nl/downloads/document?id=2025D33387" },
  { label: "TopGear – Benzine-adviesprijs 2,415 €/l op 13 nov. 2026, record 2,732 op 10 okt.", url: "https://topgear.nl/autonieuws/benzine-diesel-ruim-30-cent-goedkoper-recordprijzen/" },
];

export const BC_SOURCES: { label: string; url: string }[] = [
  { label: "Laadpalenviewer Rotterdam – Equans €0,37–0,39/kWh excl. btw rond de Robijnstraat", url: "https://prototype.transportlab.app/laadpalenviewer/?gemeente=rotterdam" },
  { label: "ANWB – Wat kost laden bij Tesla Superchargers?", url: "https://www.anwb.nl/auto/elektrisch-rijden/opladen/wat-kost-laden-bij-tesla-superchargers" },
  { label: "ChargeCompass – Supercharger-prijzen NL 2026 (dal €0,30, piek €0,43)", url: "https://chargecompass.app/tesla-supercharger-prices-netherlands" },
  { label: "Wegenbelastingwijzer – EV 70% t/m 2028, tabel Zuid-Holland", url: "https://www.wegenbelastingwijzer.nl/wegenbelasting-elektrische-auto" },
  { label: "Vroemie – EV-korting 2029 (75%) en 2030 (vol tarief)", url: "https://vroemie.nl/inzicht/wegenbelasting-elektrische-auto-2026" },
];

/** A live listing picked for the business case (serialisable for the client view). */
export interface BcPick {
  compareId: string;
  id: string;
  url: string;
  title: string;
  year: number | null;
  mileageKm: number | null;
  priceEur: number;
  city: string | null;
  distanceKm: number | null;
  seller: string | null;
  soh: number | null;
  pano: boolean | null;
  premiumAudio: boolean | null;
  towHitch: boolean | null;
  /** Mach-E: trim level and AWD ("Premium", "AWD"); empty elsewhere. */
  tags: string[];
  /** Price vs. the tracker's price model, in % (negative = below market). */
  vsModelPct: number | null;
  source: string | null;
  /** Meets every must-have in lib/wishes.ts (the picks themselves may relax audio). */
  fitsWishes: boolean;
  wishTitle: string;
}

export interface BreakEven {
  /** Extra (positive) or saved (negative) cost vs. keeping the current car, over the whole period. */
  gap: number;
  /** Asking price at which this car costs the same as keeping the current one,
   *  with the same resale value at the end (every euro off the price is a euro less depreciation). */
  priceEur: number;
  /** Energy/fuel budget per year at which it breaks even, and what that means per kWh or litre. */
  energyPerYear: number;
  /** Average €/kWh (EV, incl. charging losses) or €/l (petrol car) at break-even. Null for PHEVs. */
  unitPrice: number | null;
  unit: "kWh" | "l" | null;
  /** Today's petrol price at which it breaks even (later years keep the scenario's increase on top;
   *  both this car and the current one burn petrol). Null = never. */
  petrolEur: number | null;
}

export function breakEven(v: BcVehicle, cost: CostBreakdown, current: CostBreakdown, i: BcInputs): BreakEven {
  const n = i.years;
  const gap = cost.total - current.total;
  // d(total)/d(price) with a fixed resale value: depreciation 1:1 plus interest on the average capital.
  const priceEur = cost.purchase - gap / (1 + (i.interestPct / 100) * n / 2);
  const energyPerYearBE = (cost.energy - gap) / n;
  const k = i.kmPerYear / 100;
  let unitPrice: number | null = null;
  let unit: BreakEven["unit"] = null;
  if (v.kind === "ev") {
    const f = v.fastCharge === "none" ? 0 : i.fastSharePct / 100;
    const kwhDrawn = k * v.kwhPer100 * ((1 - f) * AC_LOSS + f * DC_LOSS);
    unitPrice = energyPerYearBE / kwhDrawn;
    unit = "kWh";
  } else if (v.kind === "ice") {
    unitPrice = energyPerYearBE / (k * (v.litersPer100 ?? 6));
    unit = "l";
  }
  // Petrol price: both totals are linear in it (the scenario adds the same €/l every year).
  const litresRow = v.kind === "ice" ? k * (v.litersPer100 ?? 6)
    : v.kind === "phev" ? k * (1 - i.phevElectricPct / 100) * (v.litersPer100 ?? 6.5) : 0;
  const litresCur = k * i.current.litersPer100;
  const slope = (litresCur - litresRow) * n; // how much faster keeping gets expensive per €/l
  const petrolEur = slope > 0 ? Math.max(0, i.petrolEur + gap / slope) : null;
  return { gap, priceEur, energyPerYear: energyPerYearBE, unitPrice, unit, petrolEur };
}
