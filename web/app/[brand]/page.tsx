import fs from "node:fs";
import path from "node:path";
import { notFound } from "next/navigation";
import type { Dataset } from "@/lib/types";
import { BRANDS, BRAND_KEYS, isBrandKey } from "@/lib/brands";
import { Dashboard } from "@/components/dashboard";

// Read the committed per-brand dataset at build time. The daily GitHub Action
// regenerates public/<brand>.json and commits it, triggering a Vercel redeploy.
export const dynamic = "force-static";

export function generateStaticParams() {
  return BRAND_KEYS.map((brand) => ({ brand }));
}

function loadData(brand: string): Dataset {
  const file = path.join(process.cwd(), "public", `${brand}.json`);
  return JSON.parse(fs.readFileSync(file, "utf-8")) as Dataset;
}

export default function Page({ params }: { params: { brand: string } }) {
  if (!isBrandKey(params.brand)) notFound();
  const data = loadData(params.brand);
  return <Dashboard data={data} brand={BRANDS[params.brand]} />;
}
