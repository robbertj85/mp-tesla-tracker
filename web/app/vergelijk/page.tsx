import fs from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import type { Dataset } from "@/lib/types";
import type { BrandKey } from "@/lib/brands";
import { COMPARE_DATASETS } from "@/lib/comparison";
import { SiteHeader } from "@/components/site-header";
import { ComparisonView } from "@/components/comparison";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Vergelijk — alle getrackte auto's naast elkaar",
};

function loadData(brand: BrandKey): Dataset | undefined {
  const file = path.join(process.cwd(), "public", `${brand}.json`);
  if (!fs.existsSync(file)) return undefined;
  return JSON.parse(fs.readFileSync(file, "utf-8")) as Dataset;
}

export default function VergelijkPage() {
  const datasets: Partial<Record<BrandKey, Dataset>> = {};
  for (const b of COMPARE_DATASETS) datasets[b] = loadData(b);
  const dates = Object.values(datasets).map((d) => d?.generatedAt).filter(Boolean).sort();
  return (
    <div className="container max-w-7xl px-3 py-6 sm:px-4 sm:py-8">
      <SiteHeader active="vergelijk"
        subtitle={`Ruimte, audio, bereik, accugezondheid en markt per model · live data van ${dates.at(-1) ?? "—"}`} />
      <ComparisonView datasets={datasets} />
    </div>
  );
}
