"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buildArchetypes, type Archetype } from "@/lib/archetypes";
import type { Dataset } from "@/lib/types";
import type { BrandConfig } from "@/lib/brands";
import { eur, km } from "@/lib/utils";

const genBadge: Record<string, "default" | "secondary"> = {
  Highland: "default", Juniper: "default", "Pre-Highland": "secondary", "Pre-Juniper": "secondary",
};

export function Archetypes({ data, brand }: { data: Dataset; brand: BrandConfig }) {
  const isTesla = brand.dimensions.hw;
  const rows = React.useMemo(
    () => buildArchetypes(data.listings, data.linearModel, brand),
    [data.listings, data.linearModel, brand]
  );
  const byModel = React.useMemo(() => {
    const m = new Map<string, Archetype[]>();
    for (const r of rows) {
      if (!m.has(r.model)) m.set(r.model, []);
      m.get(r.model)!.push(r);
    }
    return [...m.entries()];
  }, [rows]);

  if (!data.linearModel) {
    return <p className="text-sm text-muted-foreground">Nog geen prijsmodel beschikbaar.</p>;
  }

  return (
    <div className="space-y-6">
      {byModel.map(([model, list]) => (
        <Card key={model}>
          <CardHeader>
            <CardTitle>{brand.label} {model}</CardTitle>
            <CardDescription>
              {isTesla
                ? "Geschatte redelijke prijs per uitvoering, op basis van de mediaan bouwjaar/km/range en meest voorkomende HW & FSD binnen die groep."
                : "Geschatte redelijke prijs per uitvoering, op basis van de mediaan bouwjaar/km/vermogen binnen die groep (brandstof × aandrijving)."}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-y text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Uitvoering</th>
                    {isTesla ? (
                      <>
                        <th className="px-3 py-2 text-left font-medium">Generatie</th>
                        <th className="px-3 py-2 text-left font-medium">HW</th>
                        <th className="px-3 py-2 text-left font-medium">FSD</th>
                        <th className="px-3 py-2 text-right font-medium">Actieradius</th>
                      </>
                    ) : (
                      <>
                        <th className="px-3 py-2 text-left font-medium">Aandrijving</th>
                        <th className="px-3 py-2 text-right font-medium">Vermogen</th>
                      </>
                    )}
                    <th className="px-3 py-2 text-right font-medium">Bouwjaar</th>
                    <th className="px-3 py-2 text-right font-medium">Mediaan km</th>
                    <th className="px-3 py-2 text-right font-medium">Mediaan vraag</th>
                    <th className="px-4 py-2 text-right font-medium">Geschatte prijs</th>
                    <th className="px-3 py-2 text-right font-medium">n</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((r) => (
                    <tr key={r.key} className="border-b last:border-0 hover:bg-muted/40">
                      <td className="px-4 py-2.5 font-medium">{r.label}</td>
                      {isTesla ? (
                        <>
                          <td className="px-3 py-2.5">
                            <Badge variant={genBadge[r.generation ?? ""] ?? "secondary"}>{r.generation}</Badge>
                          </td>
                          <td className="px-3 py-2.5">{r.modeHw ?? "—"}</td>
                          <td className="px-3 py-2.5">
                            {r.fsd ? <Badge variant="good">FSD</Badge> :
                              <span className="text-muted-foreground">{Math.round(r.fsdShare * 100)}%</span>}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums">
                            {r.medianRange ? `${r.medianRange} km` : "—"}
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-3 py-2.5">{r.drivetrain ?? "—"}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums">{r.medianPower ? `${r.medianPower} pk` : "—"}</td>
                        </>
                      )}
                      <td className="px-3 py-2.5 text-right tabular-nums">{r.medianYear ?? "—"}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{km(r.medianMileage)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{eur(r.medianAsking)}</td>
                      <td className="px-4 py-2.5 text-right text-base font-semibold tabular-nums">{eur(r.estimatedEur)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{r.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ))}
      <p className="text-xs text-muted-foreground">
        &quot;Geschatte prijs&quot; komt uit hetzelfde lineaire model als de prijsschatter. &quot;Mediaan
        vraag&quot; is de werkelijke mediaan vraagprijs binnen de groep — verschillen wijzen op over-/
        ondergewaardeerde uitvoeringen. Groepen met weinig advertenties (lage n) zijn minder betrouwbaar.
      </p>
    </div>
  );
}
