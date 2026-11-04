// Business case (/businesscase): total cost of ownership for the shortlisted
// cars near Rotterdam vs. keeping the current (damaged, 272k km) Skoda.
//
// Static assumptions researched 2026-11-04. Insurance and maintenance are
// estimates, not quotes. Depreciation comes from each tracker's own price model
// (€ per year of age + € per km), so it follows the live market.

import type { BrandKey } from "./brands";

export interface BcVehicle {
  /** Same id as in COMPARE_VEHICLES, whose `match` picks the listings. */
  compareId: string;
  name: string;
  dataset: BrandKey;
  /** Key in dataset.models whose regression gives the depreciation. */
  modelKey: string;
  kind: "ev" | "phev";
  /** Premium audio required for a pick (ID.4: Harman Kardon is too rare, so not). */
  requireAudio: boolean;
  /** Average consumption over the year, battery side (kWh/100 km), from the real
   *  summer/winter range on /vergelijk. PHEV: in electric mode. */
  kwhPer100: number;
  /** Petrol (l/100 km) with an empty battery. PHEV only. */
  litersPer100?: number;
  /** Where it can fast-charge: Tesla price, Supercharger with/without subscription, or not at all. */
  fastCharge: "tesla" | "other" | "none";
  /** Empty mass (RDW "massa ledig voertuig", approx.) for road tax. */
  massKg: number;
  /** Insurance estimate €/month, Zuid-Holland 3051, 7 claim-free years. Scaled to
   *  the €110/month the user pays now for the old Skoda — get real quotes. */
  insurance: { allrisk: number; waPlus: number };
  /** Servicing, APK, wipers, brake fluid etc. per year, excl. tyres. */
  maintenancePerYear: number;
  /** Tyre wear, €/km (set price / life). */
  tyresPerKm: number;
  /** HV battery warranty: years from first registration and km. */
  batteryWarranty: { years: number; km: number };
  roadsideNote: string;
  notes: string;
}

export const BC_VEHICLES: BcVehicle[] = [
  {
    compareId: "tesla-y-lr", name: "Model Y LR AWD", dataset: "tesla", modelKey: "Model Y",
    kind: "ev", requireAudio: true, kwhPer100: 17.3, fastCharge: "tesla", massKg: 1909,
    insurance: { allrisk: 150, waPlus: 105 },
    maintenancePerYear: 250, tyresPerKm: 0.028,
    batteryWarranty: { years: 8, km: 192_000 },
    roadsideNote: "Tesla Roadside alleen binnen de basisgarantie (4 jaar / 80.000 km)",
    notes: "Banden slijten sneller (gewicht + koppel); 19\" set ~€1.000 per ~35.000 km. Geen olie, nauwelijks remslijtage.",
  },
  {
    compareId: "superb-iv", name: "Superb Combi iV", dataset: "skoda", modelKey: "Superb",
    kind: "phev", requireAudio: true, kwhPer100: 18.5, litersPer100: 6.5, fastCharge: "none", massKg: 1710,
    insurance: { allrisk: 120, waPlus: 85 },
    maintenancePerYear: 700, tyresPerKm: 0.017,
    batteryWarranty: { years: 8, km: 160_000 },
    roadsideNote: "Skoda Mobiliteitsgarantie verlengt bij onderhoud bij de dealer",
    notes: "Jaarlijkse olie-beurt, DSG-olie elke 60.000 km (~€350), bougies, remmen. Twee aandrijflijnen = meer kans op reparaties. Laadt alleen AC 3,6 kW.",
  },
  {
    compareId: "mach-e-er", name: "Mach-E ER RWD", dataset: "mach-e", modelKey: "Mustang",
    kind: "ev", requireAudio: true, kwhPer100: 19.4, fastCharge: "other", massKg: 1993,
    insurance: { allrisk: 135, waPlus: 95 },
    maintenancePerYear: 350, tyresPerKm: 0.025,
    batteryWarranty: { years: 8, km: 160_000 },
    roadsideNote: "Ford Assistance verlengt bij onderhoud bij de dealer",
    notes: "Onderhoud elke 2 jaar / 30.000 km. Check recall 22S41 (HV-hoofdrelais) en de 12V-accu.",
  },
  {
    compareId: "id4-pro", name: "ID.4 Pro 77 kWh", dataset: "id4", modelKey: "ID.4",
    kind: "ev", requireAudio: false, kwhPer100: 19.2, fastCharge: "other", massKg: 2050,
    insurance: { allrisk: 120, waPlus: 85 },
    maintenancePerYear: 350, tyresPerKm: 0.023,
    batteryWarranty: { years: 8, km: 160_000 },
    roadsideNote: "VW Mobiliteitsgarantie verlengt bij onderhoud bij de dealer",
    notes: "Harman Kardon is zeldzaam, dus picks alleen op trekhaak. Onderhoud elke 2 jaar / 30.000 km.",
  },
];

/** Picks: only dealers/sellers within this distance of Rotterdam (3051). */
export const BC_MAX_DISTANCE_KM = 40;
export const BC_PICKS_PER_VEHICLE = 2;

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
  /** Superb iV: share of km driven electrically. */
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
  /** Price vs. the tracker's price model, in % (negative = below market). */
  vsModelPct: number | null;
  source: string | null;
}
