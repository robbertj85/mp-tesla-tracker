import fs from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import type { Dataset, Listing } from "@/lib/types";
import { BRANDS, BRAND_KEYS, type BrandKey } from "@/lib/brands";
import { macheTags, soh } from "@/lib/listing-checks";
import { nearMiss, wishFit, wishTitle } from "@/lib/wishes";
import { SiteHeader } from "@/components/site-header";
import { WishList, type WishRow } from "@/components/wish-list";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Past bij je wensen — alle trackers",
};

function loadData(brand: BrandKey): Dataset | undefined {
  const file = path.join(process.cwd(), "public", `${brand}.json`);
  if (!fs.existsSync(file)) return undefined;
  return JSON.parse(fs.readFileSync(file, "utf-8")) as Dataset;
}

function toRow(brand: BrandKey, data: Dataset, l: Listing, near: string | null): WishRow {
  const w = wishFit(l);
  return {
    id: l.id,
    brand,
    // Single-model trackers read better by their own name ("Mach-E", not "Mustang").
    model: data.facets.models.length > 1 ? l.model : BRANDS[brand].label,
    // Mach-E: also the trim level and AWD ("Extended Range · Premium · AWD").
    variant: [l.trim ?? (l.fuel === "Electric" ? null : l.fuel),
      ...(brand === "mach-e" ? macheTags(brand, l) : [l.equipment_line])].filter(Boolean).join(" · ") || null,
    url: l.url,
    title: l.title,
    source: l.source,
    year: l.year,
    mileageKm: l.mileage_km,
    priceEur: l.price_eur,
    predictedEur: l.predictedEur,
    residualEur: l.residualEur,
    vsModelPct: l.predictedEur && l.residualEur != null ? (l.residualEur / l.predictedEur) * 100 : null,
    distanceKm: l.distance_km,
    city: l.city,
    soh: soh(l),
    powerHp: l.power_hp,
    rangeKm: l.range_km,
    pano: !!l.pano,
    firstSeen: l.first_seen,
    near,
    wishTitle: wishTitle(w),
  };
}

export default function WensenPage() {
  const rows: WishRow[] = [];
  const dates: string[] = [];
  for (const b of BRAND_KEYS) {
    if (BRANDS[b].wishStars === false) continue;
    const data = loadData(b);
    if (!data) continue;
    dates.push(data.generatedAt);
    const picked = data.listings
      .map((l) => ({ l, fits: wishFit(l).fits, near: nearMiss(l) }))
      .filter((x) => x.fits || x.near);
    // The same car is sometimes listed twice (one seller, or Marktplaats + Gaspedaal).
    const seen = new Set<string>();
    for (const { l, near } of picked) {
      const key = [l.seller_name, l.year, l.mileage_km, l.price_eur].join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push(toRow(b, data, l, near));
    }
  }
  return (
    <div className="container max-w-screen-2xl px-3 py-6 sm:px-4 sm:py-8">
      <SiteHeader active="wensen"
        subtitle={`Alle advertenties met een ster, uit elke tracker · live data van ${dates.sort().at(-1) ?? "—"}`} />
      <WishList rows={rows} />
    </div>
  );
}
