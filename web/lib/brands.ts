// Per-brand UI configuration. The scraper keeps Tesla and Skoda in separate
// datasets (web/public/<brand>.json); this declares how each brand renders so the
// shared components show the right dimensions (Tesla: trim/HW/FSD/range; Skoda:
// fuel/transmission/drivetrain) without mixing the two brands.

export type BrandKey = "tesla" | "skoda";

/** Which categorical/numeric dimensions are meaningful for a brand. Drives the
 *  filter bar, listings columns, estimator inputs, scatter axes and archetypes. */
export interface BrandDimensions {
  trim: boolean;
  hw: boolean;
  fsd: boolean;
  range: boolean;
  fuel: boolean;
  transmission: boolean;
  drivetrain: boolean;
}

export interface BrandConfig {
  key: BrandKey;
  label: string;
  /** Short "X & Y" model phrase for the header subtitle. */
  modelsLabel: string;
  /** Fixed dot/line colours per model so scatter dots and trend lines match. */
  modelColors: Record<string, string>;
  dimensions: BrandDimensions;
}

export const BRANDS: Record<BrandKey, BrandConfig> = {
  tesla: {
    key: "tesla",
    label: "Tesla",
    modelsLabel: "Model 3 & Model Y",
    modelColors: { "Model 3": "#2563eb", "Model Y": "#dc2626" },
    dimensions: {
      trim: true, hw: true, fsd: true, range: true,
      fuel: false, transmission: false, drivetrain: true,
    },
  },
  skoda: {
    key: "skoda",
    label: "Skoda",
    modelsLabel: "Octavia & Superb",
    modelColors: { Octavia: "#059669", Superb: "#7c3aed" },
    dimensions: {
      trim: false, hw: false, fsd: false, range: false,
      fuel: true, transmission: true, drivetrain: true,
    },
  },
};

export const BRAND_KEYS = Object.keys(BRANDS) as BrandKey[];

export function isBrandKey(v: string): v is BrandKey {
  return v in BRANDS;
}
