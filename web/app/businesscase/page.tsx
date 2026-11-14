import fs from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import type { Dataset } from "@/lib/types";
import type { BrandKey } from "@/lib/brands";
import { COMPARE_VEHICLES } from "@/lib/comparison";
import {
  BC_MAX_DISTANCE_KM, BC_VEHICLES, fitDepreciation, type BcPick, type Depreciation,
} from "@/lib/business-case";
import { KNOWN_TRAP_IDS, macheTags, soh, TRAP_RE, used } from "@/lib/listing-checks";
import { WISH_MIN_SOH, wishFit, wishTitle } from "@/lib/wishes";
import { SiteHeader } from "@/components/site-header";
import { BusinessCaseView } from "@/components/business-case";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Business case — totale kosten per auto",
};

function loadData(brand: BrandKey): Dataset | undefined {
  const file = path.join(process.cwd(), "public", `${brand}.json`);
  if (!fs.existsSync(file)) return undefined;
  return JSON.parse(fs.readFileSync(file, "utf-8")) as Dataset;
}

/** % per year of age and % per km, fitted on this model's live used listings. */
function depreciation(data: Dataset, modelKey: string): Depreciation | null {
  const refYear = new Date(data.generatedAt).getFullYear();
  return fitDepreciation(data.listings.filter((l) => used(l) && l.model === modelKey), refYear);
}

export default function BusinessCasePage() {
  const picks: BcPick[] = [];
  const deps: Record<string, Depreciation> = {};
  const dates: string[] = [];
  for (const v of BC_VEHICLES) {
    const data = loadData(v.dataset);
    const match = v.match ?? COMPARE_VEHICLES.find((c) => c.id === v.compareId)?.match;
    if (!data || !match) continue;
    dates.push(data.generatedAt);
    const dep = depreciation(data, v.modelKey);
    if (dep) deps[v.compareId] = dep;
    const rel = (l: Dataset["listings"][number]) => (l.residualEur ?? 0) / (l.predictedEur || 1);
    data.listings
      .filter((l) => used(l) && match(l) && l.predictedEur != null)
      .filter((l) => (!v.requireTow || l.tow_hitch) && (!v.requireAudio || l.premium_audio))
      .filter((l) => !TRAP_RE.test(l.title ?? "") && !KNOWN_TRAP_IDS.has(l.id) && (l.mileage_km ?? 0) <= 150_000)
      .filter((l) => { const s = soh(l); return s == null || s >= WISH_MIN_SOH; })
      .filter((l) => l.distance_km != null && l.distance_km <= BC_MAX_DISTANCE_KM)
      .sort((a, b) => rel(a) - rel(b))
      // The same car is sometimes listed twice by one seller.
      .filter((l, idx, arr) => arr.findIndex((o) =>
        o.seller_name === l.seller_name && o.year === l.year && o.mileage_km === l.mileage_km && o.price_eur === l.price_eur) === idx)
      .slice(0, v.picks)
      .forEach((l) => picks.push({
        compareId: v.compareId,
        id: l.id,
        url: l.url,
        title: l.title,
        year: l.year,
        mileageKm: l.mileage_km,
        priceEur: l.price_eur!,
        city: l.city,
        distanceKm: l.distance_km,
        seller: l.seller_name,
        soh: soh(l),
        pano: l.pano ?? null,
        premiumAudio: l.premium_audio ?? null,
        towHitch: l.tow_hitch ?? null,
        tags: macheTags(v.dataset, l),
        vsModelPct: l.predictedEur ? rel(l) * 100 : null,
        source: l.source,
        fitsWishes: wishFit(l).fits,
        wishTitle: wishTitle(wishFit(l)),
      }));
  }
  return (
    <div className="container max-w-screen-2xl px-3 py-6 sm:px-4 sm:py-8">
      <SiteHeader active="businesscase"
        subtitle={`Totale kosten van de beste auto's binnen ${BC_MAX_DISTANCE_KM} km van Rotterdam vs. de huidige Skoda houden · live data van ${dates.sort().at(-1) ?? "—"}`} />
      <BusinessCaseView picks={picks} deps={deps} />
    </div>
  );
}
