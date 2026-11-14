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

export interface BcInputs {
  kmPerYear: number;
  years: number;
  petrolEur: number;
  /** Equans street pole near Robijnstraat, incl. VAT and a typical card markup. */
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
    energy: energyPerYear(v, i) * n,
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
    energy: (i.kmPerYear / 100) * c.litersPer100 * i.petrolEur * n,
    roadTax: c.roadTaxMonthly * 12 * n,
    insurance: c.insuranceMonthly * 12 * n,
    maintenance,
    roadside: i.roadsidePerYear * n,
    interest: (c.residualEur / 2) * (i.interestPct / 100) * n,
  }, n);
}

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
  /** Petrol price at which it breaks even (both this car and the current one burn petrol). Null = never. */
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
  // Petrol price: both totals are linear in it.
  const litresRow = v.kind === "ice" ? k * (v.litersPer100 ?? 6)
    : v.kind === "phev" ? k * (1 - i.phevElectricPct / 100) * (v.litersPer100 ?? 6.5) : 0;
  const litresCur = k * i.current.litersPer100;
  const slope = (litresCur - litresRow) * n; // how much faster keeping gets expensive per €/l
  const petrolEur = slope > 0 ? Math.max(0, i.petrolEur + gap / slope) : null;
  return { gap, priceEur, energyPerYear: energyPerYearBE, unitPrice, unit, petrolEur };
}
