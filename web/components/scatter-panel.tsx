"use client";

import * as React from "react";
import {
  CartesianGrid, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart,
  Tooltip, XAxis, YAxis, Legend,
} from "recharts";
import type { Listing } from "@/lib/types";
import type { BrandConfig } from "@/lib/brands";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { eur } from "@/lib/utils";

const CURRENT_YEAR = 2026;

const X_AXES = {
  mileage_km: { label: "Kilometerstand", fmt: (v: number) => `${Math.round(v / 1000)}k` },
  age: { label: "Leeftijd (jaar)", fmt: (v: number) => String(v) },
  power_hp: { label: "Vermogen (pk)", fmt: (v: number) => String(v) },
} as const;
type XKey = keyof typeof X_AXES;

type ColorKey = string;

const PALETTE = ["#2563eb", "#dc2626", "#059669", "#d97706", "#7c3aed", "#0891b2",
  "#db2777", "#65a30d", "#475569", "#ca8a04"];

function xValue(l: Listing, key: XKey): number | null {
  if (key === "age") return l.year ? CURRENT_YEAR - l.year : null;
  return (l[key] as number | null) ?? null;
}

function ols(points: { x: number; y: number }[]) {
  const n = points.length;
  if (n < 3) return null;
  const sx = points.reduce((a, p) => a + p.x, 0);
  const sy = points.reduce((a, p) => a + p.y, 0);
  const sxx = points.reduce((a, p) => a + p.x * p.x, 0);
  const sxy = points.reduce((a, p) => a + p.x * p.y, 0);
  const denom = n * sxx - sx * sx;
  if (denom === 0) return null;
  const b = (n * sxy - sx * sy) / denom;
  const a = (sy - b * sx) / n;
  return { a, b };
}

export function ScatterPanel({ listings, brand }: { listings: Listing[]; brand: BrandConfig }) {
  const dim = brand.dimensions;
  // Fixed colours per model so dots and that model's regression line always match.
  const modelColor = (m: string, fallback: string) => brand.modelColors[m] ?? fallback;
  const colorOptions: ColorKey[] = React.useMemo(() => {
    const opts = ["model"];
    if (dim.source) opts.push("source");
    if (dim.trim) opts.push("trim");
    if (dim.hw) opts.push("hw_platform");
    if (dim.fuel) opts.push("fuel");
    if (dim.drivetrain) opts.push("drivetrain");
    opts.push("dealLabel");
    return opts;
  }, [dim]);
  const [xKey, setXKey] = React.useState<XKey>("mileage_km");
  const [colorKey, setColorKey] = React.useState<ColorKey>("model");

  const points = React.useMemo(
    () =>
      listings
        .map((l) => ({
          x: xValue(l, xKey),
          y: l.price_eur,
          group: String((l as unknown as Record<string, unknown>)[colorKey] ?? "onbekend"),
          model: l.model,
          listing: l,
        }))
        .filter((p): p is { x: number; y: number; group: string; model: string; listing: Listing } =>
          p.x != null && p.y != null),
    [listings, xKey, colorKey]
  );

  const groups = React.useMemo(() => {
    const m = new Map<string, typeof points>();
    for (const p of points) {
      if (!m.has(p.group)) m.set(p.group, []);
      m.get(p.group)!.push(p);
    }
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [points]);

  // One regression line per Tesla model (Model 3 vs Model Y), each fit over its
  // own points — so depreciation curves are compared, not blended together.
  const modelTrends = React.useMemo(() => {
    const byModel = new Map<string, { x: number; y: number }[]>();
    for (const p of points) {
      if (!byModel.has(p.model)) byModel.set(p.model, []);
      byModel.get(p.model)!.push({ x: p.x, y: p.y });
    }
    type Pt = { x: number; y: number };
    const out: { model: string; segment: [Pt, Pt] }[] = [];
    for (const [model, pts] of byModel) {
      const fit = ols(pts);
      if (!fit) continue;
      const xs = pts.map((p) => p.x);
      const min = Math.min(...xs), max = Math.max(...xs);
      out.push({
        model,
        segment: [
          { x: min, y: fit.a + fit.b * min },
          { x: max, y: fit.a + fit.b * max },
        ],
      });
    }
    return out.sort((a, b) => a.model.localeCompare(b.model));
  }, [points]);

  const xMeta = X_AXES[xKey];

  // Clicking a dot opens its Marktplaats ad. Recharts hands the clicked entry as
  // the first arg (the original datum, sometimes nested under `.payload`).
  const openListing = (entry: any) => {
    const url = entry?.listing?.url ?? entry?.payload?.listing?.url;
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0">
        <CardTitle>Prijs vs. kenmerk · {points.length} auto&apos;s</CardTitle>
        <div className="flex gap-2">
          <Select value={xKey} onValueChange={(v) => setXKey(v as XKey)}>
            <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(X_AXES).map(([k, v]) => (
                <SelectItem key={k} value={k}>X: {v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={colorKey} onValueChange={(v) => setColorKey(v as ColorKey)}>
            <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {colorOptions.map((k) => (
                <SelectItem key={k} value={k}>Kleur: {k}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={460}>
          <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis type="number" dataKey="x" name={xMeta.label} tickFormatter={xMeta.fmt}
              domain={["dataMin", "dataMax"]} tick={{ fontSize: 12 }}
              label={{ value: xMeta.label, position: "insideBottom", offset: -10, fontSize: 12 }} />
            <YAxis type="number" dataKey="y" name="Prijs" tickFormatter={(v) => `${Math.round(v / 1000)}k`}
              tick={{ fontSize: 12 }} width={48} />
            <Tooltip content={<ScatterTooltip xMeta={xMeta} />} cursor={{ strokeDasharray: "3 3" }} />
            <Legend />
            {modelTrends.map(({ model, segment }) => (
              <ReferenceLine key={model} segment={segment} stroke={modelColor(model, "#111827")}
                strokeWidth={2} strokeDasharray="6 4" ifOverflow="extendDomain" />
            ))}
            {groups.map(([group, pts], i) => (
              <Scatter key={group} name={`${group} (${pts.length})`} data={pts}
                fill={colorKey === "model" ? modelColor(group, PALETTE[i % PALETTE.length]) : PALETTE[i % PALETTE.length]}
                fillOpacity={0.75} className="cursor-pointer" onClick={openListing} />
            ))}
          </ScatterChart>
        </ResponsiveContainer>
        <p className="mt-2 text-xs text-muted-foreground">
          Klik op een punt om de advertentie te openen. Stippellijnen = aparte
          lineaire trend (kleinste kwadraten) per model. De volledige multi-feature
          schatting staat onder &quot;Prijs schatten&quot;.
        </p>
      </CardContent>
    </Card>
  );
}

function ScatterTooltip({ active, payload, xMeta }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload as { listing?: Listing; x: number; trend?: number };
  if (!p.listing) return null;
  const l = p.listing;
  return (
    <div className="rounded-md border bg-background p-2 text-xs shadow-md">
      <div className="font-medium">{l.model} {l.trim ?? ""} · {l.year}</div>
      <div className="text-muted-foreground">
        {eur(l.price_eur)} · {xMeta.label}: {xMeta.fmt(p.x)} · HW {l.hw_platform ?? "?"}
      </div>
      {l.predictedEur != null && (
        <div className="text-muted-foreground">Schatting: {eur(l.predictedEur)} ({l.dealLabel})</div>
      )}
      <div className="mt-1 text-[11px] text-muted-foreground">Klik om de advertentie te openen ↗</div>
    </div>
  );
}
