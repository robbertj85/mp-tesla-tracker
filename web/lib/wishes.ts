// "Past bij je wensen": does an ad meet the buyer's must-haves? One rule for every
// tracker, the same bar /businesscase and /vergelijk use for their picks:
//   * premium audio (B&O, Canton, JBL, Harman Kardon, Tesla premium, …);
//   * a tow hitch on EVs, for a tow-bar box (a roof box costs too much range);
//     petrol and PHEV cars can carry a roof box instead;
//   * at most 150,000 km;
//   * EVs: a seller-stated SoH of at least 92%, or none stated (ask for a report);
//   * no trap in the title (export, defect, ex-VAT, lease quote, …).
// A panoramic roof is a bonus, not a requirement. Boot size is a property of the
// model, not the ad, so it lives on /vergelijk instead.

import { KNOWN_TRAP_IDS, soh, TRAP_RE, used } from "./listing-checks";
import type { Listing } from "./types";

export const WISH_MAX_KM = 150_000;
export const WISH_MIN_SOH = 92;

export interface WishFit {
  fits: boolean;
  /** Must-haves this ad meets / misses, in Dutch, for the tooltip. */
  met: string[];
  missing: string[];
  /** Nice-to-haves present (panoramic roof). */
  bonus: string[];
}

export const isEv = (l: Listing) => l.fuel === "Electric";

export function wishFit(l: Listing): WishFit {
  const met: string[] = [];
  const missing: string[] = [];
  const check = (ok: boolean, label: string) => (ok ? met : missing).push(label);

  check(!!l.premium_audio, "premium audio");
  if (isEv(l)) check(!!l.tow_hitch, "trekhaak");
  check(l.mileage_km != null && l.mileage_km <= WISH_MAX_KM, `≤ ${WISH_MAX_KM / 1000}k km`);
  if (isEv(l)) {
    const s = soh(l);
    check(s == null || s >= WISH_MIN_SOH, s == null ? "SoH onbekend (vraag een rapport)" : `SoH ${s}%`);
  }
  check(used(l) && !TRAP_RE.test(l.title ?? "") && !KNOWN_TRAP_IDS.has(l.id), "geen valkuil");

  return { fits: missing.length === 0, met, missing, bonus: l.pano ? ["panoramadak"] : [] };
}

export const fitsWishes = (l: Listing) => wishFit(l).fits;

/** Tooltip text for the star. */
export function wishTitle(w: WishFit): string {
  const head = w.fits ? "Past bij je wensen" : "Past niet bij je wensen";
  const parts = [`✓ ${w.met.join(", ")}`];
  if (w.missing.length) parts.push(`✕ ${w.missing.join(", ")}`);
  if (w.bonus.length) parts.push(`+ ${w.bonus.join(", ")}`);
  return `${head}: ${parts.join(" · ")}`;
}

// "Bijna": ads that miss exactly one must-have, and only by a small margin.
// Audio and tow hitch are yes/no, so they never count as "just missed".
export const NEAR_MAX_KM = 165_000;
export const NEAR_MIN_SOH = 90;

/** What a near-miss ad just misses ("162k km", "SoH 91%"), or null if it fits or
 *  misses by more. */
export function nearMiss(l: Listing): string | null {
  const w = wishFit(l);
  if (w.fits || w.missing.length !== 1) return null;
  const kmOver = l.mileage_km != null && l.mileage_km > WISH_MAX_KM && l.mileage_km <= NEAR_MAX_KM;
  if (kmOver) return `${Math.round(l.mileage_km! / 1000)}k km`;
  const s = isEv(l) ? soh(l) : null;
  if (s != null && s >= NEAR_MIN_SOH && s < WISH_MIN_SOH) return `SoH ${s}%`;
  return null;
}
