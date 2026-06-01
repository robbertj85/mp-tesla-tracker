export type DealLabel = "good_deal" | "fair" | "overpriced";

export interface Listing {
  id: string;
  url: string;
  title: string;
  model: string;
  trim: string | null;
  is_highland: boolean;
  year: number | null;
  mileage_km: number | null;
  price_eur: number | null;
  price_type: string | null;
  condition: string | null;
  color: string | null;
  interior_color: string | null;
  body: string | null;
  drivetrain: string | null;
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

export interface Importance {
  feature: string;
  importance: number;
}

export interface PricePoint {
  date: string;
  priceEur: number;
}

export interface Dataset {
  generatedAt: string;
  sourceQuery: string;
  summary: {
    count: number;
    medianPriceEur: number | null;
    avgMileageKm: number | null;
    byModel: Record<string, number>;
  };
  metrics: {
    n: number;
    linear_mae?: number;
    linear_r2?: number;
    gbr_mae?: number;
    note?: string;
  };
  importances: Importance[];
  linearModel: LinearModel | null;
  facets: {
    models: string[];
    trims: string[];
    colors: string[];
    hwPlatforms: string[];
    conditions: string[];
    drivetrains: string[];
    years: number[];
  };
  listings: Listing[];
  priceHistory: Record<string, PricePoint[]>;
}
