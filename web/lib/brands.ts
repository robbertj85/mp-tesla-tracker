// Per-brand UI configuration. The scraper keeps Tesla and Skoda in separate
// datasets (web/public/<brand>.json); this declares how each brand renders so the
// shared components show the right dimensions (Tesla: trim/HW/FSD/range; Skoda:
// fuel/transmission/drivetrain) without mixing the two brands.

export type BrandKey = "tesla" | "skoda" | "octavia" | "model-s" | "enyaq";

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
  /** Whether listings carry a Marktplaats/Tesla.com source split (Bron filter,
   *  source badge, and the 3-way Marktplaats/Tesla/Combined price model). */
  source: boolean;
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
      fuel: false, transmission: false, drivetrain: true, source: true,
    },
  },
  skoda: {
    key: "skoda",
    label: "Skoda",
    modelsLabel: "Octavia & Superb",
    modelColors: { Octavia: "#059669", Superb: "#7c3aed" },
    dimensions: {
      trim: false, hw: false, fsd: false, range: false,
      fuel: true, transmission: true, drivetrain: true, source: false,
    },
  },
  // Tesla Model S resale view (build years 2013+, mileage <= 250.000 km). Same
  // Tesla dimensions; the HW filter spans HW1/HW2/HW2.5/HW3/HW4 for this model.
  "model-s": {
    key: "model-s",
    label: "Model S",
    modelsLabel: "Tesla Model S vanaf 2013 · max 250.000 km",
    modelColors: { "Model S": "#2563eb" },
    dimensions: {
      trim: true, hw: true, fsd: true, range: true,
      fuel: false, transmission: false, drivetrain: true, source: true,
    },
  },
  // Older-Octavia resale view (build years 2006–2014, all bodies, both gearboxes).
  octavia: {
    key: "octavia",
    label: "Octavia '06–'14",
    modelsLabel: "Skoda Octavia 2006–2014 · automaat vs handgeschakeld",
    modelColors: { Octavia: "#059669" },
    dimensions: {
      trim: false, hw: false, fsd: false, range: false,
      fuel: true, transmission: true, drivetrain: true, source: false,
    },
  },
  // Skoda Enyaq (full-electric SUV + Coupé, build years 2021+). Every car is
  // electric with a single-speed automatic, so those two filters would only ever
  // offer one value — drivetrain (RWD vs AWD) is the meaningful driveline split.
  enyaq: {
    key: "enyaq",
    label: "Enyaq",
    modelsLabel: "Skoda Enyaq iV & Coupé · volledig elektrisch",
    modelColors: { Enyaq: "#0891b2" },
    dimensions: {
      trim: false, hw: false, fsd: false, range: false,
      fuel: false, transmission: false, drivetrain: true, source: false,
    },
  },
};

export const BRAND_KEYS = Object.keys(BRANDS) as BrandKey[];

export function isBrandKey(v: string): v is BrandKey {
  return v in BRANDS;
}
