export type DealLabel = "good_deal" | "fair" | "overpriced";

export interface Listing {
  id: string;
  brand: string | null;
  /** "marktplaats" | "tesla" — which marketplace the listing came from. */
  source: string | null;
  url: string;
  title: string;
  model: string;
  trim: string | null;
  is_highland: boolean;
  is_juniper: boolean;
  year: number | null;
  mileage_km: number | null;
  price_eur: number | null;
  price_type: string | null;
  condition: string | null;
  color: string | null;
  interior_color: string | null;
  body: string | null;
  drivetrain: string | null;
  fuel: string | null;
  transmission: string | null;
  power_hp: number | null;
  range_km: number | null;
  num_seats: number | null;
  fsd: boolean;
  autopilot_package: string;
  soh_percent: number | null;
  hw_platform: string | null;
  hw_source: string | null;
  hw_confidence: string | null;
  city: string | null;
  distance_km: number | null;
  seller_name: string | null;
  view_count: number | null;
  favorited_count: number | null;
  post_date: string | null;
  first_seen: string;
  last_seen: string;
  thumbnail: string | null;
  predictedEur: number | null;
  residualEur: number | null;
  dealLabel: DealLabel | null;
}

export interface NumericSpec {
  median: number;
  mean: number;
  std: number;
  coef: number;
}

export interface LinearModel {
  intercept: number;
  numeric: Record<string, NumericSpec>;
  categorical: Record<string, Record<string, number>>;
  numericFeatures: string[];
  categoricalFeatures: string[];
}

export interface ModelMetrics {
  n: number;
  linear_mae?: number;
  linear_r2?: number;
  gbr_mae?: number;
  note?: string;
}

/** A trained regression + its metrics. One pooled entry ("__combined__") plus
 *  one per `model` group (e.g. "Model 3", "Model Y"). */
export interface ModelEntry {
  label: string;
  linearModel: LinearModel | null;
  metrics: ModelMetrics;
}

export const COMBINED_KEY = "__combined__";
export const MARKTPLAATS_KEY = "__marktplaats__";
export const TESLA_KEY = "__tesla__";

export interface Importance {
  feature: string;
  importance: number;
}

export interface PricePoint {
  date: string;
  priceEur: number;
}

/** Market-wide price stats for one capture day (see export._price_trends). */
export interface PriceTrendPoint {
  date: string;
  count: number;
  avg: number;
  median: number;
  min: number;
  max: number;
  mode: number;
}

export interface Dataset {
  brand: string;
  generatedAt: string;
  sourceQuery: string;
  summary: {
    count: number;
    medianPriceEur: number | null;
    avgMileageKm: number | null;
    byModel: Record<string, number>;
    bySource?: Record<string, number>;
  };
  metrics: ModelMetrics;
  importances: Importance[];
  linearModel: LinearModel | null;
  /** Pooled + per-`model` regressions. Optional for back-compat with older data.json. */
  models?: Record<string, ModelEntry>;
  facets: {
    models: string[];
    sources?: string[];
    trims: string[];
    colors: string[];
    hwPlatforms: string[];
    conditions: string[];
    drivetrains: string[];
    fuels: string[];
    transmissions: string[];
    years: number[];
  };
  listings: Listing[];
  priceHistory: Record<string, PricePoint[]>;
  /** Market-wide price stats per capture day. Optional for back-compat. */
  priceTrends?: PriceTrendPoint[];
}
