"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { BcInputs } from "@/lib/business-case";
import { SEEK_VARS, seek, type SeekCar, type SeekVar } from "@/lib/goal-seek";
import { cn, eur, km } from "@/lib/utils";

// Doelzoeker: "welke waarde van X maakt deze auto even duur als houden
// (of €D/mnd duurder/goedkoper)?" — per car, live on the current inputs.

function fmt(v: SeekVar, x: number): string {
  if (v.unit === "€") return eur(x);
  if (v.unit === "km") return km(x);
  const n = x.toLocaleString("nl-NL", { minimumFractionDigits: v.digits, maximumFractionDigits: v.digits });
  return v.unit === "%" ? `${n}%` : v.unit.startsWith("€") ? `€${n}${v.unit.slice(1)}` : `${n} ${v.unit}`;
}

export function GoalSeek({ cars, inputs, setInputs }: {
  cars: SeekCar[];
  inputs: BcInputs;
  setInputs: (i: BcInputs) => void;
}) {
  const [varKey, setVarKey] = React.useState("price");
  const [target, setTarget] = React.useState(0);
  const v = SEEK_VARS.find((x) => x.key === varKey)!;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Doelzoeker</CardTitle>
        <CardDescription>
          Kies wat er mag veranderen en waar je op uit wilt komen; per auto rekent de browser uit welke waarde daarvoor nodig is
          (de rest blijft zoals hierboven ingesteld). Met &quot;Toepassen&quot; zet je die waarde in de uitgangspunten.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-4 text-sm">
          <label className="block text-xs">
            <span className="font-medium text-foreground">Wat mag er veranderen?</span>
            <select value={varKey} onChange={(e) => setVarKey(e.target.value)}
              className="mt-1 block rounded-md border bg-background px-2 py-1.5 text-sm">
              {SEEK_VARS.map((x) => <option key={x.key} value={x.key}>{x.label} ({x.unit})</option>)}
            </select>
          </label>
          <label className="block text-xs">
            <span className="font-medium text-foreground">Doel: maandkosten t.o.v. huidige Skoda houden</span>
            <span className="mt-1 flex items-center gap-1">
              <input type="number" value={target} step={10}
                onChange={(e) => { const x = parseFloat(e.target.value); if (Number.isFinite(x)) setTarget(x); }}
                className="w-28 rounded-md border bg-background px-2 py-1.5 text-sm tabular-nums" />
              <span className="text-muted-foreground">€/mnd</span>
            </span>
          </label>
          <p className="text-xs text-muted-foreground">
            0 = break-even · +50 = mag €50/mnd duurder zijn · −50 = moet €50/mnd goedkoper zijn
          </p>
        </div>

        <div className="-mx-6 overflow-x-auto sm:mx-0">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium sm:px-0">Auto</th>
                <th className="px-2 py-2 text-right font-medium">Nu</th>
                <th className="px-2 py-2 text-right font-semibold text-foreground">Nodig</th>
                <th className="px-2 py-2 text-right font-medium">Verschil</th>
                <th className="px-3 py-2 sm:px-0" />
              </tr>
            </thead>
            <tbody>
              {cars.map((c) => {
                const r = seek(c, v, inputs, target);
                return (
                  <tr key={c.key} className="border-b align-top">
                    <td className="px-3 py-2 text-xs sm:px-0">
                      <span className="font-semibold">{c.vehicle.name}</span>
                      <span className="block text-muted-foreground">
                        {c.pick.year} · {km(c.pick.mileageKm)} · {eur(c.pick.priceEur)} · {c.pick.seller ?? c.pick.city}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">{fmt(v, r.now)}</td>
                    <td className="px-2 py-2 text-right font-semibold tabular-nums">
                      {r.kind === "ok" && fmt(v, r.x)}
                      {r.kind === "na" && <span className="font-normal text-muted-foreground">n.v.t.</span>}
                      {r.kind === "none" && (
                        <span className="font-normal text-rose-600">
                          niet haalbaar
                          <span className="block text-xs text-muted-foreground">
                            bij {fmt(v, r.bestAt)} nog {r.bestGap > 0 ? "+" : "−"}{eur(Math.abs(r.bestGap))}/mnd
                          </span>
                        </span>
                      )}
                    </td>
                    <td className={cn("px-2 py-2 text-right tabular-nums", r.kind === "ok" && "text-muted-foreground")}>
                      {r.kind === "ok" ? `${r.x - r.now >= 0 ? "+" : "−"}${fmt(v, Math.abs(r.x - r.now))}` : ""}
                    </td>
                    <td className="px-3 py-2 text-right sm:px-0">
                      {r.kind === "ok" && v.scope !== "listing" && (
                        <button
                          onClick={() => setInputs(v.set(inputs, Math.round(r.x * 10 ** v.digits) / 10 ** v.digits, c))}
                          className="rounded-md border px-2 py-0.5 text-xs hover:bg-secondary"
                          title={v.scope === "global" ? "zet deze waarde voor alle auto's" : "zet deze waarde voor dit model"}>
                          Toepassen
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">
          Rekent per auto één variabele door (zoekt het punt waar de meerkosten precies het doel raken). Aanschafprijs: bij dezelfde
          restwaarde aan het eind. Zonnestroom: zet de zon-toggle aan; in de zomer begrenst de laadbehoefte van de auto wat erin kan,
          dus 100% opwek is niet altijd genoeg. Benzineprijs en reparatie/onderhoud van de huidige Skoda veranderen ook de kosten van houden.
        </p>
      </CardContent>
    </Card>
  );
}
