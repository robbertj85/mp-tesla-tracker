import fs from "node:fs";
import path from "node:path";
import type { Dataset } from "@/lib/types";
import { Dashboard } from "@/components/dashboard";

// Read the committed dataset at build time. The daily GitHub Action regenerates
// public/data.json and commits it, which triggers a Vercel redeploy.
export const dynamic = "force-static";

function loadData(): Dataset {
  const file = path.join(process.cwd(), "public", "data.json");
  return JSON.parse(fs.readFileSync(file, "utf-8")) as Dataset;
}

export default function Page() {
  const data = loadData();
  return <Dashboard data={data} />;
}
