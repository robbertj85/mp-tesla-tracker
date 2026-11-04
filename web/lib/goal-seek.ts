// Goal seek for the business case: pick one input, and per car find the value
// at which its monthly cost hits a target (break-even with keeping the current
// Skoda, or a chosen difference per month). One variable at a time, solved by
// bisection: every cost here is monotonic in each input (linear, or piecewise
// with caps), so a sign change between the bounds means exactly one answer.

import {
  currentCarCost, MAINT_REF_KM, vehicleCost,
  type BcInputs, type BcPick, type BcVehicle, type Depreciation,
} from "./business-case";

export interface SeekCar {
  key: string;
  vehicle: BcVehicle;
  pick: BcPick;
  dep: Depreciation;
}

export interface SeekVar {
  key: string;
  label: string;
  unit: string;
  min: number;
  max: number;
  /** Decimals to show. */
  digits: number;
  /** Current value for this car. */
  get: (i: BcInputs, c: SeekCar) => number;
  /** Inputs with the variable set to x (price is handled separately). */
  set: (i: BcInputs, x: number, c: SeekCar) => BcInputs;
  /** "car" = differs per car (apply to that car only); "global" = one input for all cars. */
  scope: "car" | "global" | "listing";
}

export const SEEK_VARS: SeekVar[] = [
  {
    key: "price", label: "Aanschafprijs", unit: "€", min: 1000, max: 100_000, digits: 0, scope: "listing",
    get: (_, c) => c.pick.priceEur, set: (i) => i,
  },
  {
    key: "streetKwhEur", label: "Laadprijs straat", unit: "€/kWh", min: 0, max: 2, digits: 2, scope: "global",
    get: (i) => i.streetKwhEur, set: (i, x) => ({ ...i, streetKwhEur: x }),
  },
  {
    key: "fastSharePct", label: "Aandeel Supercharger dal", unit: "%", min: 0, max: 100, digits: 0, scope: "global",
    get: (i) => i.fastSharePct, set: (i, x) => ({ ...i, fastSharePct: x }),
  },
  {
    key: "solarAvailablePct", label: "Deel zonne-opwek naar de auto", unit: "%", min: 0, max: 100, digits: 0, scope: "global",
    get: (i) => (i.solar.enabled ? i.solar.availablePct : 0),
    set: (i, x) => ({ ...i, solar: { ...i.solar, enabled: true, availablePct: x } }),
  },
  {
    key: "solarMaxHomePct", label: "Max. deel laden thuis (zon)", unit: "%", min: 0, max: 100, digits: 0, scope: "global",
    get: (i) => (i.solar.enabled ? i.solar.maxHomePct : 0),
    set: (i, x) => ({ ...i, solar: { ...i.solar, enabled: true, maxHomePct: x } }),
  },
  {
    key: "solarYearKwh", label: "Zonne-opwek per jaar", unit: "kWh", min: 0, max: 20_000, digits: 0, scope: "global",
    get: (i) => (i.solar.enabled ? i.solar.yearKwh : 0),
    set: (i, x) => ({ ...i, solar: { ...i.solar, enabled: true, yearKwh: x } }),
  },
  {
    key: "kmPerYear", label: "Km per jaar", unit: "km", min: 1000, max: 80_000, digits: 0, scope: "global",
    get: (i) => i.kmPerYear, set: (i, x) => ({ ...i, kmPerYear: x }),
  },
  {
    key: "petrolEur", label: "Benzineprijs", unit: "€/l", min: 0, max: 15, digits: 2, scope: "global",
    get: (i) => i.petrolEur, set: (i, x) => ({ ...i, petrolEur: x }),
  },
  {
    key: "insurance", label: "Verzekering", unit: "€/mnd", min: 0, max: 500, digits: 0, scope: "car",
    get: (i, c) => i.insurance[c.vehicle.compareId] ?? c.vehicle.insurance.allrisk,
    set: (i, x, c) => ({ ...i, insurance: { ...i.insurance, [c.vehicle.compareId]: x } }),
  },
  {
    key: "repairEur", label: "Reparatie huidige Skoda", unit: "€", min: 0, max: 30_000, digits: 0, scope: "global",
    get: (i) => i.current.repairEur, set: (i, x) => ({ ...i, current: { ...i.current, repairEur: x } }),
  },
  {
    key: "maintenancePerYear", label: "Onderhoud huidige Skoda", unit: "€/jr", min: 0, max: 15_000, digits: 0, scope: "global",
    get: (i) => i.current.maintenancePerYear, set: (i, x) => ({ ...i, current: { ...i.current, maintenancePerYear: x } }),
  },
];

/** Monthly cost of this car minus keeping the current Skoda, minus the target. */
function gapFn(c: SeekCar, v: SeekVar, i: BcInputs, targetPerMonth: number): (x: number) => number {
  if (v.key === "price") {
    // Same resale value at the end: each euro off the price is a euro less depreciation, plus less interest.
    const base = vehicleCost(c.vehicle, c.pick.priceEur, c.pick.mileageKm ?? MAINT_REF_KM, c.dep, i);
    const months = i.years * 12;
    const cur = currentCarCost(i).perMonth;
    return (x) => base.perMonth + ((x - c.pick.priceEur) * (1 + (i.interestPct / 100) * i.years / 2)) / months - cur - targetPerMonth;
  }
  return (x) => {
    const j = v.set(i, x, c);
    return vehicleCost(c.vehicle, c.pick.priceEur, c.pick.mileageKm ?? MAINT_REF_KM, c.dep, j).perMonth - currentCarCost(j).perMonth - targetPerMonth;
  };
}

export type SeekResult =
  | { kind: "ok"; x: number; now: number }
  | { kind: "none"; now: number; bestAt: number; bestGap: number } // target not reachable within bounds
  | { kind: "na"; now: number }; // this input doesn't affect this car

export function seek(c: SeekCar, v: SeekVar, i: BcInputs, targetPerMonth: number): SeekResult {
  const f = gapFn(c, v, i, targetPerMonth);
  const now = v.get(i, c);
  let lo = v.min;
  let hi = v.max;
  let flo = f(lo);
  const fhi = f(hi);
  if (Math.abs(flo - fhi) < 1e-6) return { kind: "na", now };
  if (Math.sign(flo) === Math.sign(fhi)) {
    const bestAt = Math.abs(flo) < Math.abs(fhi) ? lo : hi;
    return { kind: "none", now, bestAt, bestGap: Math.min(Math.abs(flo), Math.abs(fhi)) * Math.sign(flo) };
  }
  for (let k = 0; k < 80 && hi - lo > 1e-6 * (v.max - v.min); k++) {
    const mid = (lo + hi) / 2;
    const fm = f(mid);
    if (Math.sign(fm) === Math.sign(flo)) { lo = mid; flo = fm; } else { hi = mid; }
  }
  return { kind: "ok", x: (lo + hi) / 2, now };
}
