"use client";

import * as React from "react";
import { Calculator } from "lucide-react";
import type { Dataset, ModelEntry } from "@/lib/types";
import { COMBINED_KEY, MARKTPLAATS_KEY, TESLA_KEY } from "@/lib/types";
import type { BrandConfig } from "@/lib/brands";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { predictPrice } from "@/lib/predict";
import { eur } from "@/lib/utils";

const CURRENT_YEAR = 2026;

type Mode = "separate" | "combined";

export function PriceEstimator({ data, brand }: { data: Dataset; brand: BrandConfig }) {
  const f = data.facets;
  const dim = brand.dimensions;
  // Year-slider bounds follow the brand's actual data (Tesla 2017+, Octavia
  // 2006–2014, …) instead of a hardcoded range. facets.years is sorted ascending.
  const minYear = f.years.length ? f.years[0] : 2017;
  const maxYear = f.years.length ? f.years[f.years.length - 1] : CURRENT_YEAR;
  const clampYear = (y: number) => Math.min(maxYear, Math.max(minYear, y));
  const [state, setState] = React.useState({
    mode: "separate" as Mode,
    // Which price model to use for source-split brands (Marktplaats/Tesla/Combined).
    priceKey: MARKTPLAATS_KEY as string,
    model: f.models[0] ?? "Model 3",
    trim: f.trims[0] ?? "unknown",
    drivetrain: f.drivetrains[0] ?? "unknown",
    hw_platform: f.hwPlatforms[0] ?? "unknown",
    fsd: "no",
    fuel: f.fuels[0] ?? "unknown",
    transmission: f.transmissions[0] ?? "unknown",
    condition: f.conditions[0] ?? "unknown",
    year: clampYear(2021),
    mileage_km: 80000,
  });

  // Pooled model, with a fallback to the legacy top-level fields for older data.json.
  const combined: ModelEntry = data.models?.[COMBINED_KEY] ?? {
    label: "Alle modellen",
    linearModel: data.linearModel,
    metrics: data.metrics,
  };
  const group = data.models?.[state.model];

  // Source-split brands (Tesla / Model S) pick a *market* model — Marktplaats,
  // Tesla.com, or the two combined. Other brands keep the per-model vs pooled
  // toggle. Either way, fall back to the combined model when the chosen segment
  // had too little data to train.
  let active: ModelEntry;
  let fellBack: boolean;
  if (dim.source) {
    const market = data.models?.[state.priceKey];
    fellBack = !market?.linearModel;
    active = fellBack ? combined : market!;
  } else {
    fellBack = state.mode === "separate" && !group?.linearModel;
    active = state.mode === "combined" || fellBack ? combined : group!;
  }
  const lm = active.linearModel;

  if (!lm) {
    return (
      <Card><CardContent className="py-10 text-center text-muted-foreground">
        Nog te weinig data om een model te trainen ({active.metrics.note ?? "minimaal 15 auto's nodig"}).
      </CardContent></Card>
    );
  }

  const estimate = predictPrice(lm, {
    ...state,
    age: Math.max(0, CURRENT_YEAR - state.year),
  });

  const set = (patch: Partial<typeof state>) => setState({ ...state, ...patch });
  const Sel = ({ label, value, onChange, options }: {
    label: string; value: string; onChange: (v: string) => void; options: string[];
  }) => (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-muted-foreground">{label}</label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          {options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );

  const ModeBtn = ({ value, children }: { value: Mode; children: React.ReactNode }) => (
    <button
      type="button"
      onClick={() => set({ mode: value })}
      className={
        "rounded-md px-3 py-1 text-xs font-medium transition-colors " +
        (state.mode === value
          ? "bg-background text-foreground shadow"
          : "text-muted-foreground hover:text-foreground")
      }
    >
      {children}
    </button>
  );

  const KeyBtn = ({ value, children }: { value: string; children: React.ReactNode }) => (
    <button
      type="button"
      onClick={() => set({ priceKey: value })}
      className={
        "rounded-md px-3 py-1 text-xs font-medium transition-colors " +
        (state.priceKey === value
          ? "bg-background text-foreground shadow"
          : "text-muted-foreground hover:text-foreground")
      }
    >
      {children}
    </button>
  );

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_320px]">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <CardTitle>Schat een redelijke prijs</CardTitle>
            {dim.source ? (
              <div className="inline-flex items-center rounded-lg bg-muted p-1">
                <KeyBtn value={MARKTPLAATS_KEY}>Marktplaats</KeyBtn>
                <KeyBtn value={TESLA_KEY}>Tesla.com</KeyBtn>
                <KeyBtn value={COMBINED_KEY}>Gecombineerd</KeyBtn>
              </div>
            ) : (
              <div className="inline-flex items-center rounded-lg bg-muted p-1">
                <ModeBtn value="separate">Per model</ModeBtn>
                <ModeBtn value="combined">Gecombineerd</ModeBtn>
              </div>
            )}
          </div>
          <CardDescription>
            {dim.source ? (
              <>Prijsmodel <b>{active.label}</b> ({active.metrics.n} advertenties, R² {active.metrics.linear_r2}).</>
            ) : state.mode === "combined" ? (
              <>Eén regressie over alle modellen samen ({active.metrics.n} advertenties, R² {active.metrics.linear_r2}).</>
            ) : (
              <>Aparte regressie voor {state.model} ({active.metrics.n} advertenties, R² {active.metrics.linear_r2}).</>
            )}{" "}
            Berekend in je browser — exact dezelfde formule als het Python-model.
            {fellBack && (
              <span className="mt-1 block text-amber-600">
                {dim.source
                  ? "Te weinig data in dit prijsmodel — gecombineerd model gebruikt."
                  : `Te weinig ${state.model}-data voor een aparte regressie — gecombineerd model gebruikt.`}
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3">
          <Sel label="Model" value={state.model} onChange={(v) => set({ model: v })} options={f.models} />
          {dim.trim && <Sel label="Trim" value={state.trim} onChange={(v) => set({ trim: v })} options={f.trims} />}
          {dim.fuel && <Sel label="Brandstof" value={state.fuel} onChange={(v) => set({ fuel: v })} options={f.fuels} />}
          {dim.transmission && <Sel label="Transmissie" value={state.transmission} onChange={(v) => set({ transmission: v })} options={f.transmissions} />}
          {dim.drivetrain && <Sel label="Aandrijving" value={state.drivetrain} onChange={(v) => set({ drivetrain: v })} options={f.drivetrains} />}
          {dim.hw && <Sel label="Hardware" value={state.hw_platform} onChange={(v) => set({ hw_platform: v })} options={f.hwPlatforms} />}
          {dim.fsd && <Sel label="FSD" value={state.fsd} onChange={(v) => set({ fsd: v })} options={["no", "yes"]} />}
          <Sel label="Staat" value={state.condition} onChange={(v) => set({ condition: v })} options={f.conditions} />
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Bouwjaar: {state.year}</label>
            <input type="range" min={minYear} max={maxYear} value={state.year}
              onChange={(e) => set({ year: Number(e.target.value) })} className="accent-primary" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Km-stand: {state.mileage_km.toLocaleString("nl-NL")}</label>
            <input type="range" min={0} max={300000} step={5000} value={state.mileage_km}
              onChange={(e) => set({ mileage_km: Number(e.target.value) })} className="accent-primary" />
          </div>
        </CardContent>
      </Card>

      <Card className="flex flex-col items-center justify-center bg-muted/30">
        <CardContent className="py-10 text-center">
          <Calculator className="mx-auto mb-3 h-6 w-6 text-muted-foreground" />
          <div className="text-sm text-muted-foreground">Geschatte redelijke prijs</div>
          <div className="mt-1 text-4xl font-bold tabular-nums">{eur(estimate)}</div>
          <div className="mt-3 text-xs text-muted-foreground">
            {state.model} {dim.trim ? state.trim : dim.fuel ? state.fuel : ""} · {state.year} · {state.mileage_km.toLocaleString("nl-NL")} km
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
