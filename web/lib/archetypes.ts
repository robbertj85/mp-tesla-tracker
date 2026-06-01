import type { Listing, LinearModel } from "./types";
import type { BrandConfig } from "./brands";
import { predictPrice } from "./predict";

const CURRENT_YEAR = 2026;

export type Tier = "Standard" | "Long Range" | "Performance";

/** One representative configuration. Tesla groups by generation × tier; Skoda by
 *  fuel × drivetrain. Brand-irrelevant descriptor fields are null. */
export interface Archetype {
  key: string;
  model: string;
  label: string;           // the row's primary descriptor (tier or fuel)
  generation: string | null;
  fuel: string | null;
  drivetrain: string | null;
  count: number;
  medianYear: number | null;
  medianMileage: number | null;
  medianRange: number | null;
  medianPower: number | null;
  modeHw: string | null;
  fsd: boolean;
  fsdShare: number;
  medianAsking: number | null;
  estimatedEur: number | null;
}

// Canonical order so the price ladder reads sensibly.
const TIER_ORDER: Tier[] = ["Standard", "Long Range", "Performance"];
const GEN_ORDER = ["Pre-Highland", "Highland", "Pre-Juniper", "Juniper"];

function tierOf(l: Listing): Tier | null {
  const t = (l.trim ?? "").toLowerCase();
  if (t.includes("performance")) return "Performance";
  if (t.includes("long range")) return "Long Range";
  if (t.includes("standard")) return "Standard";
  if (t.includes("rwd")) return "Standard";
  if (t.includes("awd") || t.includes("dual motor")) return "Long Range";
  return null;
}

function generationOf(l: Listing): string {
  if (l.model === "Model 3") return l.is_highland ? "Highland" : "Pre-Highland";
  if (l.model === "Model Y") return l.is_juniper ? "Juniper" : "Pre-Juniper";
  return "—";
}

function median(xs: number[]): number | null {
  const v = xs.filter((x) => x != null).sort((a, b) => a - b);
  return v.length ? v[Math.floor((v.length - 1) / 2)] : null;
}

function mode<T>(xs: T[]): T | null {
  const c = new Map<T, number>();
  for (const x of xs) if (x != null) c.set(x, (c.get(x) ?? 0) + 1);
  let best: T | null = null, n = -1;
  for (const [k, v] of c) if (v > n) { best = k; n = v; }
  return best;
}

/** Shared aggregation over a group of listings, with an estimate from the model. */
function summarise(ls: Listing[], lm: LinearModel | null): Omit<Archetype, "key" | "model" | "label" | "generation" | "fuel" | "drivetrain"> {
  const num = (f: (l: Listing) => number | null) => ls.map(f).filter((x): x is number => x != null);
  const medianYear = median(num((l) => l.year));
  const medianMileage = median(num((l) => l.mileage_km));
  const medianRange = median(num((l) => l.range_km));
  const medianPower = median(num((l) => l.power_hp));
  const modeHw = mode(ls.map((l) => l.hw_platform).filter(Boolean) as string[]);
  const fsdShare = ls.filter((l) => l.fsd).length / ls.length;
  const modeTrim = mode(ls.map((l) => l.trim).filter(Boolean) as string[]);
  const modeDrivetrain = mode(ls.map((l) => l.drivetrain).filter(Boolean) as string[]);
  const modeFuel = mode(ls.map((l) => l.fuel).filter(Boolean) as string[]);
  const modeCondition = mode(ls.map((l) => l.condition).filter(Boolean) as string[]) ?? "USED";
  const modeColor = mode(ls.map((l) => l.color).filter(Boolean) as string[]) ?? "unknown";
  const modeBody = mode(ls.map((l) => l.body).filter(Boolean) as string[]) ?? "unknown";
  const medianAsking = median(num((l) => l.price_eur));

  let estimatedEur: number | null = null;
  if (lm && medianYear != null) {
    estimatedEur = predictPrice(lm, {
      age: Math.max(0, CURRENT_YEAR - medianYear),
      mileage_km: medianMileage ?? undefined,
      power_hp: medianPower ?? undefined,
      range_km: medianRange ?? undefined,
      model: ls[0].model,
      trim: modeTrim ?? "unknown",
      drivetrain: modeDrivetrain ?? "unknown",
      hw_platform: modeHw ?? "unknown",
      fsd: fsdShare >= 0.5 ? "yes" : "no",
      fuel: modeFuel ?? "unknown",
      transmission: "Automatic",
      body: modeBody,
      color: modeColor,
      condition: modeCondition,
    });
  }
  return {
    count: ls.length, medianYear, medianMileage, medianRange, medianPower,
    modeHw, fsd: fsdShare >= 0.5, fsdShare, medianAsking, estimatedEur,
  };
}

function buildTesla(listings: Listing[], lm: LinearModel | null): Archetype[] {
  const groups = new Map<string, Listing[]>();
  for (const l of listings) {
    const tier = tierOf(l);
    if (!tier || (l.model !== "Model 3" && l.model !== "Model Y")) continue;
    const gen = generationOf(l);
    const key = `${l.model}|${gen}|${tier}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(l);
  }
  const rows: Archetype[] = [];
  for (const [key, ls] of groups) {
    const [model, generation, tier] = key.split("|");
    rows.push({ key, model, label: tier, generation, fuel: null, drivetrain: null, ...summarise(ls, lm) });
  }
  rows.sort((a, b) =>
    a.model.localeCompare(b.model) ||
    GEN_ORDER.indexOf(a.generation ?? "") - GEN_ORDER.indexOf(b.generation ?? "") ||
    TIER_ORDER.indexOf(a.label as Tier) - TIER_ORDER.indexOf(b.label as Tier)
  );
  return rows;
}

function buildSkoda(listings: Listing[], lm: LinearModel | null): Archetype[] {
  const groups = new Map<string, Listing[]>();
  for (const l of listings) {
    if (!l.fuel) continue;
    const drv = l.drivetrain ?? "—";
    const key = `${l.model}|${l.fuel}|${drv}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(l);
  }
  const rows: Archetype[] = [];
  for (const [key, ls] of groups) {
    const [model, fuel, drivetrain] = key.split("|");
    rows.push({ key, model, label: fuel, generation: null, fuel, drivetrain, ...summarise(ls, lm) });
  }
  // Petrol before PHEV, then by drivetrain, per model.
  const fuelOrder = ["Petrol", "PHEV"];
  rows.sort((a, b) =>
    a.model.localeCompare(b.model) ||
    fuelOrder.indexOf(a.fuel ?? "") - fuelOrder.indexOf(b.fuel ?? "") ||
    (a.drivetrain ?? "").localeCompare(b.drivetrain ?? "")
  );
  return rows;
}

export function buildArchetypes(listings: Listing[], lm: LinearModel | null, brand: BrandConfig): Archetype[] {
  return brand.key === "skoda" ? buildSkoda(listings, lm) : buildTesla(listings, lm);
}
