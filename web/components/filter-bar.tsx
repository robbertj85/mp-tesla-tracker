"use client";

import * as React from "react";
import type { Dataset, Listing } from "@/lib/types";
import type { BrandConfig } from "@/lib/brands";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { eur } from "@/lib/utils";

export interface Filters {
  model: string;
  source: string;
  trim: string;
  hw: string;
  fsd: string;
  fuel: string;
  transmission: string;
  drivetrain: string;
  condition: string;
  tow: string;
  yearMin: number;
  yearMax: number;
  priceMax: number;
  mileageMax: number;
}

export const defaultFilters: Filters = {
  model: "all",
  source: "all",
  trim: "all",
  hw: "all",
  fsd: "all",
  fuel: "all",
  transmission: "all",
  drivetrain: "all",
  condition: "all",
  tow: "all",
  yearMin: 2017,
  yearMax: 2026,
  priceMax: 100000,
  mileageMax: 400000,
};

export function applyFilters(l: Listing, f: Filters): boolean {
  if (f.model !== "all" && l.model !== f.model) return false;
  if (f.source !== "all" && (l.source ?? "marktplaats") !== f.source) return false;
  if (f.trim !== "all" && l.trim !== f.trim) return false;
  if (f.hw !== "all" && l.hw_platform !== f.hw) return false;
  if (f.fsd === "yes" && !l.fsd) return false;
  if (f.fsd === "no" && l.fsd) return false;
  if (f.fuel !== "all" && l.fuel !== f.fuel) return false;
  if (f.transmission !== "all" && l.transmission !== f.transmission) return false;
  if (f.drivetrain !== "all" && l.drivetrain !== f.drivetrain) return false;
  if (f.condition !== "all" && l.condition !== f.condition) return false;
  if (f.tow === "yes" && !l.tow_hitch) return false;
  if (f.tow === "no" && l.tow_hitch) return false;
  if (l.year != null && (l.year < f.yearMin || l.year > f.yearMax)) return false;
  if (l.price_eur != null && l.price_eur > f.priceMax) return false;
  if (l.mileage_km != null && l.mileage_km > f.mileageMax) return false;
  return true;
}

function Dropdown({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[];
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-muted-foreground">{label}</label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function FilterBar({ data, brand, filters, setFilters, resetTo, resultCount }: {
  data: Dataset; brand: BrandConfig; filters: Filters; setFilters: (f: Filters) => void;
  resetTo: Filters; resultCount: number;
}) {
  const dim = brand.dimensions;
  const set = (patch: Partial<Filters>) => setFilters({ ...filters, ...patch });
  const opt = (vals: (string | number)[]) => [
    { value: "all", label: "Alle" },
    ...vals.map((v) => ({ value: String(v), label: String(v) })),
  ];
  // Price slider ceiling: round the most expensive listing up to the next €5k.
  const priceCeil = React.useMemo(() => {
    const max = Math.max(5000, ...data.listings.map((l) => l.price_eur ?? 0));
    return Math.ceil(max / 5000) * 5000;
  }, [data.listings]);

  return (
    <div className="rounded-lg border bg-card p-3 sm:p-4">
      <div className="flex flex-wrap items-end gap-2 sm:gap-3">
        <Dropdown label="Model" value={filters.model} onChange={(v) => set({ model: v })} options={opt(data.facets.models)} />
        {dim.source && (
          <Dropdown label="Bron" value={filters.source} onChange={(v) => set({ source: v })}
            options={[
              { value: "all", label: "Alle" },
              { value: "marktplaats", label: "Marktplaats" },
              { value: "tesla", label: "Tesla.com" },
            ]} />
        )}
        {dim.trim && (
          <Dropdown label="Trim" value={filters.trim} onChange={(v) => set({ trim: v })} options={opt(data.facets.trims)} />
        )}
        {dim.hw && (
          <Dropdown label="Hardware" value={filters.hw} onChange={(v) => set({ hw: v })} options={opt(data.facets.hwPlatforms)} />
        )}
        {dim.fsd && (
          <Dropdown label="FSD" value={filters.fsd} onChange={(v) => set({ fsd: v })}
            options={[{ value: "all", label: "Alle" }, { value: "yes", label: "Met FSD" }, { value: "no", label: "Zonder FSD" }]} />
        )}
        {dim.fuel && (
          <Dropdown label="Brandstof" value={filters.fuel} onChange={(v) => set({ fuel: v })} options={opt(data.facets.fuels)} />
        )}
        {dim.transmission && (
          <Dropdown label="Transmissie" value={filters.transmission} onChange={(v) => set({ transmission: v })} options={opt(data.facets.transmissions)} />
        )}
        {dim.drivetrain && (
          <Dropdown label="Aandrijving" value={filters.drivetrain} onChange={(v) => set({ drivetrain: v })} options={opt(data.facets.drivetrains)} />
        )}
        <Dropdown label="Staat" value={filters.condition} onChange={(v) => set({ condition: v })} options={opt(data.facets.conditions)} />
        <Dropdown label="Trekhaak" value={filters.tow} onChange={(v) => set({ tow: v })}
          options={[{ value: "all", label: "Alle" }, { value: "yes", label: "Met trekhaak" }, { value: "no", label: "Zonder" }]} />
        <Dropdown label="Bouwjaar van" value={String(filters.yearMin)}
          onChange={(v) => set({ yearMin: Number(v) })}
          options={data.facets.years.map((y) => ({ value: String(y), label: String(y) }))} />
        <Dropdown label="Bouwjaar tot" value={String(filters.yearMax)}
          onChange={(v) => set({ yearMax: Number(v) })}
          options={data.facets.years.map((y) => ({ value: String(y), label: String(y) }))} />

        <div className="flex min-w-[170px] flex-col gap-1">
          <label className="text-xs text-muted-foreground">Max. prijs: {eur(filters.priceMax)}</label>
          <input type="range" min={5000} max={priceCeil} step={500} value={Math.min(filters.priceMax, priceCeil)}
            onChange={(e) => set({ priceMax: Number(e.target.value) })} className="accent-primary" />
        </div>
        <div className="flex min-w-[170px] flex-col gap-1">
          <label className="text-xs text-muted-foreground">Max. km: {filters.mileageMax.toLocaleString("nl-NL")}</label>
          <input type="range" min={10000} max={400000} step={5000} value={filters.mileageMax}
            onChange={(e) => set({ mileageMax: Number(e.target.value) })} className="accent-primary" />
        </div>

        <div className="ml-auto flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{resultCount} resultaten</span>
          <Button variant="outline" size="sm" onClick={() => setFilters(resetTo)}>Reset</Button>
        </div>
      </div>
    </div>
  );
}
