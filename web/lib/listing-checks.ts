// Shared listing sanity checks for the cross-tracker pages (/vergelijk, /businesscase).

import type { Listing } from "./types";

// Seller-quoted battery health ("SOH 93,5%"). Tesla records carry a parsed
// soh_percent; the other EVs only have it in the title.
const SOH_RE = /\bsoh\b\D{0,15}(\d{2}(?:[.,]\d+)?)|(?<![\d.,])(\d{2}(?:[.,]\d+)?)\s*%\s*soh/i;
export function soh(l: Listing): number | null {
  if (l.soh_percent != null) return l.soh_percent <= 1.5 ? l.soh_percent * 100 : l.soh_percent;
  const m = SOH_RE.exec(l.title ?? "");
  if (!m) return null;
  const v = parseFloat((m[1] ?? m[2]).replace(",", "."));
  return v >= 70 && v <= 100 ? v : null;
}

// Ads that look cheap for a reason: export/trade-only, defects, ex-VAT, US
// imports, "pay 50% now" schemes, wanted ads. Title-only (the dataset has no text).
export const TRAP_RE = /defect|export|ex\.? ?btw|excl\.? ?btw|onderdel|schade|gezocht|\bntb\b|betaal nu|handel|import|\busa\b|amerika|lease|p\/m|per maand/i;

/** Active, priced, actually used (not a placeholder price or a demo car). */
export const used = (l: Listing) =>
  (l.active ?? true) && l.price_eur != null && l.price_eur > 5000 && (l.mileage_km ?? 0) > 1000;
