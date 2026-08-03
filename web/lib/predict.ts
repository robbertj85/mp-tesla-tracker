import type { LinearModel } from "./types";

export interface EstimatorInput {
  age: number;
  mileage_km: number;
  power_hp: number;
  range_km: number;
  battery_kwh: number;
  model: string;
  trim: string;
  equipment_line: string;
  drivetrain: string;
  hw_platform: string;
  fsd: string; // "yes" | "no"
  fuel: string;
  transmission: string;
  body: string;
  color: string;
  condition: string;
}

/**
 * Reproduce the Python Ridge prediction client-side. Must stay in lockstep with
 * scraper/mp_tesla/model.py: standardize numerics with the exported mean/std, then
 * add the matching one-hot categorical coefficient (0 for unseen categories).
 */
export function predictPrice(m: LinearModel, x: Partial<EstimatorInput>): number {
  let y = m.intercept;

  for (const feat of m.numericFeatures) {
    const spec = m.numeric[feat];
    if (!spec) continue;
    const raw = (x as Record<string, number | undefined>)[feat];
    const val = raw === undefined || raw === null || Number.isNaN(raw) ? spec.median : raw;
    y += ((val - spec.mean) / spec.std) * spec.coef;
  }

  for (const feat of m.categoricalFeatures) {
    const table = m.categorical[feat];
    if (!table) continue;
    const val = String((x as Record<string, string | undefined>)[feat] ?? "unknown");
    y += table[val] ?? 0;
  }

  return Math.round(y);
}
