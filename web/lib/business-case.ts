// Business case (/businesscase): total cost of ownership for the shortlisted
// cars near Rotterdam vs. keeping the current (damaged, 272k km) Skoda.
//
// Static assumptions researched 2026-11-04. Insurance and maintenance are
// estimates, not quotes. Depreciation comes from each tracker's own price model
// (€ per year of age + € per km), so it follows the live market.

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
  /** Premium audio required for a pick (ID.4: Harman Kardon is too rare, so not). */
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
  /** Servicing, APK, wipers, brake fluid etc. per year, excl. tyres. */
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
  /** € lost per extra year of age (positive). */
  perYear: number;
  /** € lost per extra km (positive). */
  perKm: number;
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

export function energyPerYear(v: BcVehicle, i: BcInputs): number {
  const k = i.kmPerYear / 100;
  if (v.kind === "ice") return k * (v.litersPer100 ?? 6) * i.petrolEur;
  if (v.kind === "phev") {
    const e = i.phevElectricPct / 100;
    return k * e * v.kwhPer100 * PHEV_AC_LOSS * i.streetKwhEur + k * (1 - e) * (v.litersPer100 ?? 6.5) * i.petrolEur;
  }
  const kwh = k * v.kwhPer100;
  const f = v.fastCharge === "none" ? 0 : i.fastSharePct / 100;
  const ac = kwh * (1 - f) * AC_LOSS * i.streetKwhEur;
  const dcKwh = kwh * f * DC_LOSS;
  const dc = v.fastCharge === "tesla"
    ? dcKwh * i.scOffpeakKwhEur
    : f === 0 ? 0 : Math.min(dcKwh * i.scNonTeslaKwhEur, dcKwh * i.scOffpeakKwhEur + i.scSubscriptionPerYear);
  return ac + dc;
}

export function vehicleCost(v: BcVehicle, priceEur: number, dep: Depreciation, i: BcInputs): CostBreakdown {
  const n = i.years;
  const lost = n * dep.perYear + n * i.kmPerYear * dep.perKm;
  // A linear model can run past zero for old/high-km cars; keep a 20% floor.
  const residualEnd = Math.max(priceEur * 0.2, priceEur - lost);
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
    maintenance: (v.maintenancePerYear + v.tyresPerKm * i.kmPerYear) * n,
    roadside: i.roadsidePerYear * n,
    interest: ((priceEur + residualEnd) / 2) * (i.interestPct / 100) * n,
  }, n);
}

/** Keep the current Skoda: repair it once, then run it until it's worth nothing. */
export function currentCarCost(i: BcInputs): CostBreakdown {
  const c = i.current;
  const n = i.years;
  return finish({
    purchase: c.residualEur,
    residualEnd: 0,
    depreciation: c.residualEur,
    repair: c.repairEur,
    energy: (i.kmPerYear / 100) * c.litersPer100 * i.petrolEur * n,
    roadTax: c.roadTaxMonthly * 12 * n,
    insurance: c.insuranceMonthly * 12 * n,
    maintenance: c.maintenancePerYear * n,
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
  /** Price vs. the tracker's price model, in % (negative = below market). */
  vsModelPct: number | null;
  source: string | null;
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
