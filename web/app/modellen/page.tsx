import fs from "node:fs";
import path from "node:path";
import type { Dataset } from "@/lib/types";
import { SiteHeader } from "@/components/site-header";
import { Archetypes } from "@/components/archetypes";

export const dynamic = "force-static";

function loadData(): Dataset {
  const file = path.join(process.cwd(), "public", "data.json");
  return JSON.parse(fs.readFileSync(file, "utf-8")) as Dataset;
}

export default function ModellenPage() {
  const data = loadData();
  return (
    <div className="container max-w-7xl py-8">
      <SiteHeader active="modellen"
        subtitle={`Prijsschatting per uitvoering · ${data.summary.count} advertenties · bijgewerkt ${data.generatedAt}`} />
      <Archetypes data={data} />
    </div>
  );
}
