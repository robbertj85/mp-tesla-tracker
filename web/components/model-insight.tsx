"use client";

import {
  Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import type { Dataset } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { eur } from "@/lib/utils";

const FEATURE_LABELS: Record<string, string> = {
  age: "Leeftijd", mileage_km: "Kilometerstand", power_hp: "Vermogen",
  range_km: "Actieradius", model: "Model", trim: "Trim",
  drivetrain: "Aandrijving", hw_platform: "Hardware", fsd: "FSD",
  color: "Kleur", condition: "Staat",
};

export function ModelInsight({ data }: { data: Dataset }) {
  const imp = data.importances.map((i) => ({ ...i, label: FEATURE_LABELS[i.feature] ?? i.feature }));
  const lm = data.linearModel;

  // Readable "what each thing is worth" lines from the linear coefficients.
  const drivers: { label: string; value: string }[] = [];
  if (lm) {
    const mileage = lm.numeric.mileage_km;
    if (mileage) drivers.push({ label: "Per 50.000 km meer", value: eur((mileage.coef / mileage.std) * 50000) });
    const age = lm.numeric.age;
    if (age) drivers.push({ label: "Per jaar ouder", value: eur((age.coef / age.std) * 1) });
    const fsd = lm.categorical.fsd;
    if (fsd && fsd.yes != null && fsd.no != null) drivers.push({ label: "FSD aanwezig", value: eur(fsd.yes - fsd.no) });
    const power = lm.numeric.power_hp;
    if (power) drivers.push({ label: "Per 100 pk meer", value: eur((power.coef / power.std) * 100) });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Wat bepaalt de prijs?</CardTitle>
          <CardDescription>Relatief gewicht van elk kenmerk in het prijsmodel.</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={imp} layout="vertical" margin={{ left: 20, right: 20 }}>
              <XAxis type="number" tickFormatter={(v) => `${Math.round(v * 100)}%`} tick={{ fontSize: 12 }} />
              <YAxis type="category" dataKey="label" width={90} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v: number) => `${Math.round(v * 100)}%`} />
              <Bar dataKey="importance" radius={[0, 4, 4, 0]}>
                {imp.map((_, i) => <Cell key={i} fill="#2563eb" />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Prijsdrijvers in euro&apos;s</CardTitle>
          <CardDescription>
            Geschat effect op de vraagprijs (lineair model, n={data.metrics.n}, MAE ± {eur(data.metrics.linear_mae)}).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {drivers.length === 0 ? (
            <p className="text-sm text-muted-foreground">Onvoldoende data.</p>
          ) : (
            <ul className="divide-y">
              {drivers.map((d) => (
                <li key={d.label} className="flex items-center justify-between py-2.5 text-sm">
                  <span className="text-muted-foreground">{d.label}</span>
                  <span className={`font-semibold tabular-nums ${d.value.startsWith("€-") ? "text-rose-600" : "text-emerald-600"}`}>
                    {d.value}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {data.metrics.gbr_mae != null && (
            <p className="mt-4 text-xs text-muted-foreground">
              Ter referentie: een gradient-boosted model haalt MAE ± {eur(data.metrics.gbr_mae)}.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
