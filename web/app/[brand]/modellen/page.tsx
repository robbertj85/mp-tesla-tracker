import fs from "node:fs";
import path from "node:path";
import { notFound } from "next/navigation";
import type { Dataset } from "@/lib/types";
import { BRANDS, BRAND_KEYS, isBrandKey } from "@/lib/brands";
import { SiteHeader } from "@/components/site-header";
import { Archetypes } from "@/components/archetypes";

export const dynamic = "force-static";

export function generateStaticParams() {
  return BRAND_KEYS.map((brand) => ({ brand }));
}

function loadData(brand: string): Dataset {
  const file = path.join(process.cwd(), "public", `${brand}.json`);
  return JSON.parse(fs.readFileSync(file, "utf-8")) as Dataset;
}

export default function ModellenPage({ params }: { params: { brand: string } }) {
  if (!isBrandKey(params.brand)) notFound();
  const brand = BRANDS[params.brand];
  const data = loadData(params.brand);
  return (
    <div className="container max-w-7xl py-8">
      <SiteHeader brand={brand} active="modellen"
        subtitle={`Prijsschatting per uitvoering · ${data.summary.count} advertenties · bijgewerkt ${data.generatedAt}`} />
      <Archetypes data={data} brand={brand} />
    </div>
  );
}
