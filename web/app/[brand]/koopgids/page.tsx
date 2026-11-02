import fs from "node:fs";
import path from "node:path";
import { notFound } from "next/navigation";
import type { Dataset } from "@/lib/types";
import { BRANDS, BRAND_KEYS, isBrandKey } from "@/lib/brands";
import { hasBuyingGuide } from "@/lib/buying-guide";
import { SiteHeader } from "@/components/site-header";
import { BuyingGuideView } from "@/components/buying-guide";

export const dynamic = "force-static";

export function generateStaticParams() {
  return BRAND_KEYS.filter(hasBuyingGuide).map((brand) => ({ brand }));
}

function loadData(brand: string): Dataset {
  const file = path.join(process.cwd(), "public", `${brand}.json`);
  return JSON.parse(fs.readFileSync(file, "utf-8")) as Dataset;
}

export default async function KoopgidsPage({ params }: { params: Promise<{ brand: string }> }) {
  const { brand: brandKey } = await params;
  if (!isBrandKey(brandKey) || !hasBuyingGuide(brandKey)) notFound();
  const brand = BRANDS[brandKey];
  const data = loadData(brandKey);
  return (
    <div className="container max-w-7xl px-3 py-6 sm:px-4 sm:py-8">
      <SiteHeader brand={brand} active="koopgids"
        subtitle={`Koopgids · varianten, bouwjaren en aandachtspunten · live data van ${data.generatedAt}`} />
      <BuyingGuideView data={data} brand={brand} />
    </div>
  );
}
