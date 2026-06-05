"use client";

import * as React from "react";
import {
  Area, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";
import type { PriceTrendPoint } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { eur } from "@/lib/utils";

const SERIES = [
  { key: "median", label: "Mediaan", color: "#2563eb" },
  { key: "avg", label: "Gemiddeld", color: "#dc2626" },
  { key: "mode", label: "Modus", color: "#059669" },
] as const;

export function PriceTrendsChart({ trends }: { trends?: PriceTrendPoint[] }) {
  // The min/max envelope is drawn as a stacked band: a transparent area up to
  // `min`, then a shaded area of height `max - min` on top of it.
  const data = React.useMemo(
    () => (trends ?? []).map((t) => ({ ...t, _base: t.min, _range: t.max - t.min })),
    [trends]
  );

  if (data.length < 2) {
    return (
      <Card>
        <CardHeader><CardTitle>Prijsontwikkeling</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Nog te weinig meetdagen om een prijsontwikkeling te tonen. De grafiek
            groeit naarmate de dagelijkse scrape meer dagen verzamelt
            {data.length === 1 ? ` (nu 1 meetdag: ${data[0].date})` : ""}.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Prijsontwikkeling · {data.length} meetdagen</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={420}>
          <ComposedChart data={data} margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} tickFormatter={(d) => d.slice(5)} />
            <YAxis tick={{ fontSize: 12 }} width={48} domain={["auto", "auto"]}
              tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
            <Tooltip content={<TrendTooltip />} />
            <Legend />
            {/* Min–max envelope (stacked transparent base + shaded range). */}
            <Area dataKey="_base" stackId="band" stroke="none" fill="none"
              legendType="none" isAnimationActive={false} activeDot={false} />
            <Area dataKey="_range" stackId="band" stroke="none" fill="#2563eb"
              fillOpacity={0.08} name="Min–max" isAnimationActive={false} activeDot={false} />
            {SERIES.map((s) => (
              <Line key={s.key} type="monotone" dataKey={s.key} name={s.label}
                stroke={s.color} strokeWidth={2} dot={{ r: 2 }} isAnimationActive={false} />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
        <p className="mt-2 text-xs text-muted-foreground">
          Marktbrede prijsstatistieken per scrape-dag, berekend over alle actieve
          advertenties van die dag. De lichtblauwe band loopt van de laagste tot de
          hoogste vraagprijs.
        </p>
      </CardContent>
    </Card>
  );
}

function TrendTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload as PriceTrendPoint;
  return (
    <div className="rounded-md border bg-background p-2 text-xs shadow-md">
      <div className="font-medium">{label} · {p.count} auto&apos;s</div>
      <div className="text-muted-foreground">Mediaan: {eur(p.median)}</div>
      <div className="text-muted-foreground">Gemiddeld: {eur(p.avg)}</div>
      <div className="text-muted-foreground">Modus: {eur(p.mode)}</div>
      <div className="text-muted-foreground">Min–max: {eur(p.min)} – {eur(p.max)}</div>
    </div>
  );
}
