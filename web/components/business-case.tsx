"use client";

import * as React from "react";
import { AlertTriangle, ExternalLink } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BC_DEFAULTS, BC_MAX_DISTANCE_KM, BC_SOURCES, BC_VEHICLES, breakEven, currentCarCost, energyPerYear, energySplit,
  SOLAR_PROFILE, solarToCar,
  evRoadTaxFactor, roadTaxFullPerQuarter, vehicleCost,
  type BcInputs, type BcPick, type BcVehicle, type CostBreakdown, type Depreciation,
} from "@/lib/business-case";
import { cn, eur, km } from "@/lib/utils";
import { GoalSeek } from "@/components/goal-seek";

// Total cost of ownership per shortlisted car vs. keeping the current Skoda.
// All maths lives in lib/business-case.ts; this view only holds the inputs.

function Num({ label, value, onChange, step = 1, min = 0, max, suffix, hint }: {
  label: string; value: number; onChange: (v: number) => void;
  step?: number; min?: number; max?: number; suffix?: string; hint?: string;
}) {
  return (
    <label className="block text-xs">
      <span className="font-medium text-foreground">{label}</span>
      <span className="mt-1 flex items-center gap-1">
        <input
          type="number" inputMode="decimal" value={value} step={step} min={min} max={max}
          onChange={(e) => { const v = parseFloat(e.target.value); if (Number.isFinite(v)) onChange(v); }}
          className="w-full min-w-0 rounded-md border bg-background px-2 py-1.5 text-sm tabular-nums"
        />
        {suffix && <span className="whitespace-nowrap text-muted-foreground">{suffix}</span>}
      </span>
      {hint && <span className="mt-0.5 block text-muted-foreground">{hint}</span>}
    </label>
  );
}

function Range({ label, value, onChange, min, max, step, format }: {
  label: string; value: number; onChange: (v: number) => void;
  min: number; max: number; step: number; format: (v: number) => string;
}) {
  return (
    <label className="block text-xs">
      <span className="flex justify-between font-medium text-foreground">
        {label} <span className="tabular-nums text-muted-foreground">{format(value)}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="mt-2 w-full accent-primary" />
    </label>
  );
}

interface Row {
  key: string;
  label: React.ReactNode;
  vehicle: BcVehicle | null;
  pick: BcPick | null;
  cost: CostBreakdown;
  warnings: string[];
}

const COLUMNS: { key: keyof CostBreakdown; label: string; hint?: string }[] = [
  { key: "purchase", label: "Aankoop", hint: "vraagprijs; huidige Skoda: wat hij nu nog oplevert" },
  { key: "residualEnd", label: "Restwaarde eind" },
  { key: "depreciation", label: "Afschrijving" },
  { key: "repair", label: "Reparatie" },
  { key: "energy", label: "Energie" },
  { key: "roadTax", label: "Wegenbel." },
  { key: "insurance", label: "Verzekering" },
  { key: "maintenance", label: "Onderhoud + banden" },
  { key: "roadside", label: "Pechhulp" },
  { key: "interest", label: "Rente", hint: "gemiste spaarrente op het geld dat in de auto zit" },
];

export function BusinessCaseView({ picks, deps }: { picks: BcPick[]; deps: Record<string, Depreciation> }) {
  const [inp, setInp] = React.useState<BcInputs>(BC_DEFAULTS);
  const set = <K extends keyof BcInputs>(k: K) => (v: BcInputs[K]) => setInp((s) => ({ ...s, [k]: v }));
  const setCur = <K extends keyof BcInputs["current"]>(k: K) => (v: number) =>
    setInp((s) => ({ ...s, current: { ...s.current, [k]: v } }));
  const setSolar = <K extends keyof BcInputs["solar"]>(k: K) => (v: BcInputs["solar"][K]) =>
    setInp((s) => ({ ...s, solar: { ...s.solar, [k]: v } }));
  const setIns = (id: string) => (v: number) => setInp((s) => ({ ...s, insurance: { ...s.insurance, [id]: v } }));
  const preset = (cover: "allrisk" | "waPlus") =>
    setInp((s) => ({ ...s, insurance: Object.fromEntries(BC_VEHICLES.map((v) => [v.compareId, v.insurance[cover]])) }));

  const current = currentCarCost(inp);
  const endYear = inp.startYear + inp.years - 1;
  const rows: Row[] = [
    {
      key: "current",
      label: (
        <span className="block text-xs">
          <span className="font-semibold text-foreground">Huidige Skoda houden</span>
          <span className="block text-muted-foreground">272.000 km · eenmalig repareren · eind: ~€0</span>
        </span>
      ),
      vehicle: null,
      pick: null,
      cost: current,
      warnings: [
        `Na ${inp.years} jaar ~${km(272_000 + inp.years * inp.kmPerYear)}: kans op een grote reparatie (koppeling/DSG, vering, uitlaat) zit alleen in het onderhoudsbudget.`,
      ],
    },
  ];
  for (const v of BC_VEHICLES) {
    const dep = deps[v.compareId];
    for (const p of picks.filter((x) => x.compareId === v.compareId)) {
      if (!dep) continue;
      const warnings: string[] = [];
      const kmEnd = (p.mileageKm ?? 0) + inp.years * inp.kmPerYear;
      const w = v.batteryWarranty;
      const warrantyEndYear = (p.year ?? 0) + (w?.years ?? 0);
      if (w && (kmEnd > w.km || warrantyEndYear < endYear)) {
        warnings.push(
          `Accugarantie (${w.years} jr / ${km(w.km)}) loopt af tijdens de looptijd: ` +
          `${kmEnd > w.km ? `eind-km ~${km(kmEnd)}` : `garantie tot ~${warrantyEndYear}`}.`,
        );
      }
      if (/bemiddel/i.test(p.seller ?? "")) warnings.push("Verkoper is een bemiddelaar (verkoopt namens een ander): vraag naar garantie, onderhoudshistorie en wie de eigenaar is.");
      if (p.soh == null && v.kind === "ev") warnings.push("Geen SoH in de advertentie: vraag een accurapport.");
      if ((v.compareId === "superb-iv" || v.compareId === "enyaq-80") && !p.premiumAudio) warnings.push("Canton niet bevestigd in de advertentie.");
      if (v.kind !== "ev" && !p.towHitch) warnings.push("Geen trekhaak: reken op een dakkoffer (+~10–15% verbruik als hij erop zit, niet meegerekend).");
      rows.push({
        key: p.id,
        vehicle: v,
        pick: p,
        cost: vehicleCost(v, p.priceEur, dep, inp),
        warnings,
        label: (
          <a href={p.url} target="_blank" rel="noreferrer" className="group block text-xs">
            <span className="font-semibold text-foreground group-hover:underline">
              {v.name} <ExternalLink className="inline h-3 w-3" />
            </span>
            <span className="block text-muted-foreground">
              {p.year} · {km(p.mileageKm)}{p.soh != null ? ` · SoH ${p.soh}%` : ""}
            </span>
            <span className="block text-muted-foreground">
              {p.seller ?? p.city} · {p.distanceKm} km
              {p.vsModelPct != null && (
                <span className={cn(p.vsModelPct < 0 && "text-emerald-600")}>
                  {" "}· {p.vsModelPct >= 0 ? "+" : "−"}{Math.abs(p.vsModelPct).toFixed(0)}% t.o.v. markt
                </span>
              )}
            </span>
          </a>
        ),
      });
    }
  }

  const cheapest = rows.reduce((a, b) => (b.cost.total < a.cost.total ? b : a), rows[0]);
  const cheapestNew = rows.slice(1).reduce<Row | null>((a, b) => (!a || b.cost.total < a.cost.total ? b : a), null);
  const pct = (v: number) => `${v.toFixed(0)}%`;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Conclusie bij deze instellingen</CardTitle>
          <CardDescription>
            {inp.years} jaar, {km(inp.kmPerYear)} per jaar ({inp.startYear}–{endYear}). Alles incl. btw.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <span className="font-semibold">Huidige Skoda houden:</span> {eur(current.total)} totaal, {eur(current.perMonth)} per maand.
          </p>
          {cheapestNew && (
            <p>
              <span className="font-semibold">Goedkoopste overstap:</span> {cheapestNew.vehicle?.name} ({cheapestNew.pick?.year},{" "}
              {km(cheapestNew.pick?.mileageKm)}, {eur(cheapestNew.pick?.priceEur)}) — {eur(cheapestNew.cost.perMonth)} per maand,{" "}
              <span className={cn(cheapestNew.cost.perMonth > current.perMonth ? "text-amber-600" : "text-emerald-600")}>
                {cheapestNew.cost.perMonth > current.perMonth ? "+" : "−"}
                {eur(Math.abs(cheapestNew.cost.perMonth - current.perMonth))} per maand
              </span>{" "}
              t.o.v. houden.
            </p>
          )}
          <p className="text-muted-foreground">
            Netto investering nu = vraagprijs − {eur(inp.current.residualEur)} voor de huidige Skoda. De afschrijving komt uit het
            prijsmodel van elke tracker (waardeverlies per jaar en per km in de huidige markt).
          </p>
          {cheapest.key === "current" && (
            <p className="text-muted-foreground">Puur op kosten blijft houden het goedkoopst; de overstap koop je voor ruimte, comfort, betrouwbaarheid en een trekhaak die je kunt gebruiken.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Uitgangspunten</CardTitle>
          <CardDescription>Pas aan; alles rekent direct mee.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Range label="Km per jaar" value={inp.kmPerYear} onChange={set("kmPerYear")} min={8000} max={30000} step={500}
              format={(v) => km(v)} />
            <Range label="Looptijd" value={inp.years} onChange={set("years")} min={2} max={8} step={1} format={(v) => `${v} jaar`} />
            <Range label="Snelladen (Supercharger dal)" value={inp.fastSharePct} onChange={set("fastSharePct")} min={0} max={100} step={5}
              format={pct} />
            <Range label="Plug-in hybrides elektrisch gereden" value={inp.phevElectricPct} onChange={set("phevElectricPct")} min={0} max={90} step={5}
              format={pct} />
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <Num label="Benzine" value={inp.petrolEur} onChange={set("petrolEur")} step={0.01} suffix="€/l" />
            <Num label="Laadpaal straat" value={inp.streetKwhEur} onChange={set("streetKwhEur")} step={0.01} suffix="€/kWh"
              hint="Equans incl. btw + pas" />
            <Num label="Supercharger dal" value={inp.scOffpeakKwhEur} onChange={set("scOffpeakKwhEur")} step={0.01} suffix="€/kWh"
              hint="Tesla / met abonnement" />
            <Num label="Supercharger niet-Tesla" value={inp.scNonTeslaKwhEur} onChange={set("scNonTeslaKwhEur")} step={0.01} suffix="€/kWh"
              hint={`zonder abo; abo ${eur(inp.scSubscriptionPerYear)}/jr`} />
            <Num label="Pechhulp" value={inp.roadsidePerYear} onChange={set("roadsidePerYear")} step={5} suffix="€/jr"
              hint="ANWB Wegenwacht NL" />
            <Num label="Spaarrente" value={inp.interestPct} onChange={set("interestPct")} step={0.25} suffix="%" />
          </div>
          <div className="rounded-lg border p-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={inp.solar.enabled} onChange={(e) => setSolar("enabled")(e.target.checked)}
                className="h-4 w-4 accent-primary" />
              Gratis thuis laden met de zonnepanelen
            </label>
            {inp.solar.enabled && (
              <div className="mt-3 space-y-3">
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <Num label="Opwek per jaar" value={inp.solar.yearKwh} onChange={setSolar("yearKwh")} step={100} suffix="kWh"
                    hint="piek ~350, dal ~50 kWh/mnd" />
                  <Num label="Deel opwek naar de auto" value={inp.solar.availablePct} onChange={setSolar("availablePct")} step={5} max={100} suffix="%"
                    hint="niet door het huis gebruikt, auto thuis + aan de stekker" />
                  <Num label="Max. deel laden thuis" value={inp.solar.maxHomePct} onChange={setSolar("maxHomePct")} step={5} max={100} suffix="%"
                    hint="weinig gereden = accu zit vaak vol" />
                  <Num label="Gemiste teruglevering" value={inp.solar.feedInEur} onChange={setSolar("feedInEur")} step={0.01} suffix="€/kWh"
                    hint="saldering stopt per 2027" />
                </div>
                {(() => {
                  const my = BC_VEHICLES[0];
                  const kwh = (inp.kmPerYear / 100) * my.kwhPer100 * (1 - inp.fastSharePct / 100) * 1.1;
                  const months = solarToCar(kwh, inp);
                  const max = Math.max(...SOLAR_PROFILE.map((w) => (w / SOLAR_PROFILE.reduce((a, b) => a + b, 0)) * inp.solar.yearKwh), 1);
                  return (
                    <div>
                      <p className="mb-1 text-xs text-muted-foreground">
                        {my.name} per maand: zon in de auto (groen) van de totale opwek (grijs)
                      </p>
                      <div className="grid grid-cols-12 items-end gap-1" style={{ height: 64 }}>
                        {SOLAR_PROFILE.map((w, m) => {
                          const gen = (w / SOLAR_PROFILE.reduce((a, b) => a + b, 0)) * inp.solar.yearKwh;
                          return (
                            <div key={m} className="relative h-full" title={`${Math.round(months[m])} van ${Math.round(gen)} kWh`}>
                              <div className="absolute bottom-0 w-full rounded-sm bg-muted-foreground/20" style={{ height: `${(gen / max) * 100}%` }} />
                              <div className="absolute bottom-0 w-full rounded-sm bg-emerald-500" style={{ height: `${(months[m] / max) * 100}%` }} />
                            </div>
                          );
                        })}
                      </div>
                      <div className="mt-0.5 grid grid-cols-12 gap-1 text-center text-[10px] text-muted-foreground">
                        {["j", "f", "m", "a", "m", "j", "j", "a", "s", "o", "n", "d"].map((l, m) => <span key={m}>{l}</span>)}
                      </div>
                    </div>
                  );
                })()}
                <ul className="grid gap-x-6 gap-y-0.5 text-xs text-muted-foreground sm:grid-cols-2">
                  {BC_VEHICLES.filter((v) => v.kind !== "ice").map((v) => {
                    const e = energySplit(v, inp);
                    const off = energySplit(v, { ...inp, solar: { ...inp.solar, enabled: false } });
                    const drawn = off.total > 0 ? e.solarKwh : 0;
                    return (
                      <li key={v.compareId}>
                        <span className="font-medium text-foreground">{v.name}:</span> ~{Math.round(drawn).toLocaleString("nl-NL")} kWh/jr uit de zon,
                        bespaart {eur(off.total - e.total)}/jr
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Huidige Skoda</p>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              <Num label="Restwaarde nu" value={inp.current.residualEur} onChange={setCur("residualEur")} step={100} suffix="€"
                hint="€1.000–2.000" />
              <Num label="Reparatie schade" value={inp.current.repairEur} onChange={setCur("repairEur")} step={100} suffix="€"
                hint="schatting — vul offerte in" />
              <Num label="Onderhoud" value={inp.current.maintenancePerYear} onChange={setCur("maintenancePerYear")} step={100} suffix="€/jr"
                hint="incl. banden, 272k+ km" />
              <Num label="Verzekering" value={inp.current.insuranceMonthly} onChange={setCur("insuranceMonthly")} step={5} suffix="€/mnd" />
              <Num label="Wegenbelasting" value={inp.current.roadTaxMonthly} onChange={setCur("roadTaxMonthly")} step={5} suffix="€/mnd" />
              <Num label="Verbruik" value={inp.current.litersPer100} onChange={setCur("litersPer100")} step={0.1} suffix="l/100" />
            </div>
          </div>
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Verzekering per maand (schatting)</p>
              <button onClick={() => preset("allrisk")} className="rounded-md border px-2 py-0.5 text-xs hover:bg-secondary">Allrisk</button>
              <button onClick={() => preset("waPlus")} className="rounded-md border px-2 py-0.5 text-xs hover:bg-secondary">WA + beperkt casco</button>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {BC_VEHICLES.map((v) => (
                <Num key={v.compareId} label={v.name} value={inp.insurance[v.compareId]} onChange={setIns(v.compareId)} step={5} suffix="€/mnd" />
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Zuid-Holland, postcode 3051, 7 schadevrije jaren. EV&apos;s: €165/mnd allrisk, de premie voor de Model Y van Hosni,
              aangehouden voor alle elektrische auto&apos;s. Skoda&apos;s: schatting — vraag een offerte op met kenteken.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Totale kosten over {inp.years} jaar</CardTitle>
          <CardDescription>
            Beste aanbiedingen binnen {BC_MAX_DISTANCE_KM} km van Rotterdam, laagst geprijsd t.o.v. de markt, ≤ 150.000 km, SoH ≥ 92% of
            onbekend, geen valkuil. EV&apos;s: trekhaak (voor een trekhaakkoffer — een dakkoffer kost te veel bereik) + premium audio
            (Enyaq en ID.4: alleen trekhaak — met Canton/Harman Kardon staat er geen in de buurt). Superb: Canton, dakkoffer kan. Octavia: simpel, geen eisen. Groen = goedkoopste.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0 sm:p-6 sm:pt-0">
          <table className="w-full min-w-[1100px] border-collapse text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="sticky left-0 z-10 bg-card px-3 py-2 font-medium">Auto</th>
                {COLUMNS.map((c) => (
                  <th key={c.key} title={c.hint} className="px-2 py-2 text-right font-medium">{c.label}</th>
                ))}
                <th className="px-2 py-2 text-right font-semibold text-foreground">Totaal</th>
                <th className="px-2 py-2 text-right font-semibold text-foreground">Per maand</th>
                <th className="px-3 py-2 text-right font-medium">vs. houden</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => {
                const diff = r.cost.perMonth - current.perMonth;
                const firstOfModel = idx > 0 && rows[idx - 1].vehicle?.compareId !== r.vehicle?.compareId;
                return (
                  <tr key={r.key} className={cn("border-b align-top", (idx === 1 || firstOfModel) && "border-t-2",
                    r.key === "current" && "bg-muted/40")}>
                    <td className={cn("sticky left-0 z-10 px-3 py-2", r.key === "current" ? "bg-muted" : "bg-card")}>
                      <div className="w-56">{r.label}</div>
                    </td>
                    {COLUMNS.map((c) => (
                      <td key={c.key} className="px-2 py-2 text-right tabular-nums">
                        {c.key === "repair" && r.cost.repair === 0 ? <span className="text-muted-foreground">—</span> : eur(r.cost[c.key])}
                      </td>
                    ))}
                    <td className={cn("px-2 py-2 text-right font-semibold tabular-nums", r === cheapest && "text-emerald-600")}>
                      {eur(r.cost.total)}
                    </td>
                    <td className={cn("px-2 py-2 text-right font-semibold tabular-nums", r === cheapest && "text-emerald-600")}>
                      {eur(r.cost.perMonth)}
                    </td>
                    <td className={cn("px-3 py-2 text-right tabular-nums",
                      r.key === "current" ? "text-muted-foreground" : diff > 0 ? "text-amber-600" : "text-emerald-600")}>
                      {r.key === "current" ? "—" : `${diff > 0 ? "+" : "−"}${eur(Math.abs(diff))}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Break-even met de huidige Skoda</CardTitle>
          <CardDescription>
            Wat er moet veranderen om over {inp.years} jaar even duur uit te komen als houden ({eur(current.total)}), telkens met de rest
            gelijk. Rekent mee met de instellingen hierboven.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0 sm:p-6 sm:pt-0">
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="sticky left-0 z-10 bg-card px-3 py-2 font-medium">Auto</th>
                <th className="px-2 py-2 text-right font-medium">Meerkosten</th>
                <th className="px-2 py-2 text-right font-medium" title="bij dezelfde restwaarde aan het eind">Max. aanschafprijs</th>
                <th className="px-2 py-2 text-right font-medium">Nodige korting</th>
                <th className="px-2 py-2 text-right font-medium">Max. energie/jr</th>
                <th className="px-2 py-2 text-right font-medium">= max. per kWh / l</th>
                <th className="px-3 py-2 text-right font-medium" title="benzineprijs waarbij houden even duur wordt">Break-even benzine</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(1).map((r, idx) => {
                const be = breakEven(r.vehicle!, r.cost, current, inp);
                const cheaper = be.gap <= 0;
                const firstOfModel = idx === 0 || rows[idx].vehicle?.compareId !== r.vehicle?.compareId;
                const nowEnergy = r.cost.energy / inp.years;
                return (
                  <tr key={r.key} className={cn("border-b align-top", firstOfModel && idx > 0 && "border-t-2")}>
                    <td className="sticky left-0 z-10 bg-card px-3 py-2">
                      <div className="w-56 text-xs">
                        <span className="font-semibold">{r.vehicle!.name}</span>
                        <span className="block text-muted-foreground">
                          {r.pick?.year} · {km(r.pick?.mileageKm)} · {eur(r.pick?.priceEur)} · {r.pick?.seller ?? r.pick?.city}
                        </span>
                      </div>
                    </td>
                    <td className={cn("px-2 py-2 text-right tabular-nums", cheaper ? "text-emerald-600" : "text-amber-600")}>
                      {cheaper ? "−" : "+"}{eur(Math.abs(be.gap))}
                      <span className="block text-xs text-muted-foreground">{eur(Math.abs(be.gap) / (inp.years * 12))}/mnd</span>
                    </td>
                    <td className="px-2 py-2 text-right font-semibold tabular-nums">
                      {cheaper ? <span className="font-normal text-emerald-600">al goedkoper</span> : eur(be.priceEur)}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {cheaper ? "—" : `${eur(r.cost.purchase - be.priceEur)} (${(((r.cost.purchase - be.priceEur) / r.cost.purchase) * 100).toFixed(0)}%)`}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {be.energyPerYear < 0
                        ? <span className="text-rose-600">zelfs gratis niet</span>
                        : <>{eur(be.energyPerYear)}<span className="block text-xs text-muted-foreground">nu {eur(nowEnergy)}</span></>}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {be.unitPrice == null || be.energyPerYear < 0 ? "—"
                        : `€${be.unitPrice.toFixed(2).replace(".", ",")}/${be.unit}`}
                      {be.unit === "kWh" && be.energyPerYear >= 0 && (
                        <span className="block text-xs text-muted-foreground">gem., incl. laadverlies</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {cheaper ? <span className="text-emerald-600">al goedkoper</span>
                        : be.petrolEur == null ? <span className="text-muted-foreground">nooit</span>
                        : `€${be.petrolEur.toFixed(2).replace(".", ",")}/l`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="px-3 pt-3 text-xs text-muted-foreground sm:px-0">
            Max. aanschafprijs: elke euro korting is een euro minder afschrijving (restwaarde aan het eind blijft gelijk), plus minder gemiste
            rente. Max. energie: het jaarbudget voor laden/tanken waarbij het verschil wegvalt; &quot;zelfs gratis niet&quot; = de overige
            kosten zijn al hoger dan houden. Break-even benzine: de literprijs waarbij houden (6,5 l/100) even duur wordt — bij
            plug-ins telt hun eigen benzineverbruik mee.
          </p>
        </CardContent>
      </Card>

      <GoalSeek
        inputs={inp}
        setInputs={setInp}
        cars={rows.filter((r) => r.vehicle && r.pick && deps[r.vehicle.compareId]).map((r) => ({
          key: r.key, vehicle: r.vehicle!, pick: r.pick!, dep: deps[r.vehicle!.compareId],
        }))}
      />

      <Card>
        <CardHeader>
          <CardTitle>Let op per auto</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {rows.filter((r) => r.warnings.length).map((r) => (
            <div key={r.key}>
              <p className="font-medium">
                {r.vehicle ? `${r.vehicle.name} — ${r.pick?.year}, ${km(r.pick?.mileageKm)}, ${r.pick?.seller ?? r.pick?.city}` : "Huidige Skoda"}
              </p>
              <ul className="mt-1 space-y-0.5 text-muted-foreground">
                {r.warnings.map((w) => (
                  <li key={w} className="flex gap-1.5"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />{w}</li>
                ))}
              </ul>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Aannames per model</CardTitle>
          <CardDescription>Per jaar bij de huidige instellingen.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0 sm:p-6 sm:pt-0">
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">Model</th>
                <th className="px-2 py-2 font-medium">Verbruik</th>
                <th className="px-2 py-2 text-right font-medium">Energie/jr</th>
                <th className="px-2 py-2 text-right font-medium">Wegenbel./jr</th>
                <th className="px-2 py-2 text-right font-medium">Onderhoud/jr</th>
                <th className="px-2 py-2 text-right font-medium">Waardeverlies</th>
                <th className="px-3 py-2 font-medium">Toelichting</th>
              </tr>
            </thead>
            <tbody>
              {BC_VEHICLES.map((v) => {
                const dep = deps[v.compareId];
                const tax = roadTaxFullPerQuarter(v.massKg) * 4;
                return (
                  <tr key={v.compareId} className="border-b align-top">
                    <td className="px-3 py-2 font-medium">{v.name}</td>
                    <td className="px-2 py-2 text-xs">
                      {v.kind === "ice" ? `${v.litersPer100} l/100 km`
                        : `${v.kwhPer100} kWh/100 km${v.litersPer100 ? ` · ${v.litersPer100} l/100 km (lege accu)` : ""}`}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">{eur(energyPerYear(v, inp))}</td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {v.kind === "ev" ? `${eur(tax * evRoadTaxFactor(inp.startYear))} → ${eur(tax)}` : eur(tax)}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">{eur(v.maintenancePerYear + v.tyresPerKm * inp.kmPerYear)}</td>
                    <td className="px-2 py-2 text-right text-xs tabular-nums">
                      {dep ? `${eur(dep.perYear)}/jr + ${eur(dep.perKm * 1000)}/1.000 km` : "—"}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{v.notes} {v.roadsideNote}.</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Hoe er gerekend is</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            <span className="font-medium text-foreground">Energie:</span> verbruik aan de accu uit het echte zomer/winterbereik op /vergelijk,
            plus 10% laadverlies aan de paal (11 kW), 12% voor de plug-in hybrides (3,6 kW) en 5% aan de Supercharger. Niet-Tesla's kiezen per
            jaar het goedkoopste van wel/geen Supercharger-abonnement. De Skoda’s kunnen niet snelladen. Zonnepanelen: de opwek per maand
            (profiel jan–dec) maal het deel dat naar de auto kan, met als plafond wat de auto die maand thuis zou laden; die kWh kosten
            alleen de gemiste terugleververgoeding. Snelladen op reis blijft ongewijzigd.
          </p>
          <p>
            <span className="font-medium text-foreground">Wegenbelasting:</span> Zuid-Holland (104,4 opcenten), tarieven 2026 zonder
            indexatie. EV's betalen 70% t/m 2028, 75% in 2029 en vanaf 2030 het volle tarief. Plug-in hybrides betalen het volle
            benzinetarief. Gewicht is een benadering van de massa ledig voertuig — check het exacte bedrag met het kenteken.
          </p>
          <p>
            <span className="font-medium text-foreground">Afschrijving:</span> de vraagprijs min het waardeverlies volgens het
            prijsmodel van de tracker (per jaar ouder en per km), met een bodem van 20% van de aankoopprijs.
          </p>
          <p>
            <span className="font-medium text-foreground">Niet meegenomen:</span> parkeervergunning, onverwachte grote reparaties
            buiten garantie, financiering, en de waarde van een trekhaak/ruimte die je nu niet hebt.
          </p>
          <ul className="space-y-1 pt-2">
            {BC_SOURCES.map((s) => (
              <li key={s.url}>
                <a href={s.url} target="_blank" rel="noreferrer" className="hover:underline">
                  {s.label} <ExternalLink className="inline h-3 w-3" />
                </a>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
