// Enyaq battery capacity per variant — the client-side mirror of
// ENYAQ_BATTERY_KWH in scraper/mp_tesla/config.py. Keep the two in step: the
// estimator feeds battery_kwh into the same Ridge model the scraper trained, so a
// mismatch here silently shifts every estimate.
//
// Figures are USABLE kWh (gross is 55 / 62 / 82). The 60 is the only variant with
// two packs: the 2024 facelift car (204 hp) carries 59 kWh, the original (179/180
// hp) 58 kWh.

export const ENYAQ_BATTERY_KWH: Record<string, number> = {
  "50": 52,
  "60": 58,
  "80": 77,
  "80x": 77,
  "85": 77,
  "85x": 77,
  RS: 77,
};

export const ENYAQ_FACELIFT_YEAR = 2024;
const FACELIFT_60_KWH = 59;

/** Usable battery (kWh) for a variant, or undefined when the variant is unknown.
 *  `year` only matters for the 60, whose facelift carries the bigger pack. */
export function enyaqBatteryKwh(variant: string | null | undefined, year?: number): number | undefined {
  if (!variant) return undefined;
  if (variant === "60" && year != null && year >= ENYAQ_FACELIFT_YEAR) return FACELIFT_60_KWH;
  return ENYAQ_BATTERY_KWH[variant];
}
