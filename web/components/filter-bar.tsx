"use client";

import * as React from "react";
import type { Dataset, Listing } from "@/lib/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { eur } from "@/lib/utils";

export interface Filters {
  model: string;
  trim: string;
  hw: string;
  fsd: string;
  condition: string;
  priceMax: number;
  mileageMax: number;
}

export const defaultFilters: Filters = {
  model: "all",
  trim: "all",
  hw: "all",
  fsd: "all",
  condition: "all",
  priceMax: 45000,
  mileageMax: 400000,
};

export function applyFilters(l: Listing, f: Filters): boolean {
  if (f.model !== "all" && l.model !== f.model) return false;
  if (f.trim !== "all" && l.trim !== f.trim) return false;
  if (f.hw !== "all" && l.hw_platform !== f.hw) return false;
  if (f.fsd === "yes" && !l.fsd) return false;
  if (f.fsd === "no" && l.fsd) return false;
  if (f.condition !== "all" && l.condition !== f.condition) return false;
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

export function FilterBar({ data, filters, setFilters, resultCount }: {
  data: Dataset; filters: Filters; setFilters: (f: Filters) => void; resultCount: number;
}) {
  const set = (patch: Partial<Filters>) => setFilters({ ...filters, ...patch });
  const opt = (vals: (string | number)[]) => [
    { value: "all", label: "Alle" },
    ...vals.map((v) => ({ value: String(v), label: String(v) })),
  ];

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-end gap-3">
        <Dropdown label="Model" value={filters.model} onChange={(v) => set({ model: v })} options={opt(data.facets.models)} />
        <Dropdown label="Trim" value={filters.trim} onChange={(v) => set({ trim: v })} options={opt(data.facets.trims)} />
        <Dropdown label="Hardware" value={filters.hw} onChange={(v) => set({ hw: v })} options={opt(data.facets.hwPlatforms)} />
        <Dropdown label="FSD" value={filters.fsd} onChange={(v) => set({ fsd: v })}
          options={[{ value: "all", label: "Alle" }, { value: "yes", label: "Met FSD" }, { value: "no", label: "Zonder FSD" }]} />
        <Dropdown label="Staat" value={filters.condition} onChange={(v) => set({ condition: v })} options={opt(data.facets.conditions)} />

        <div className="flex min-w-[170px] flex-col gap-1">
          <label className="text-xs text-muted-foreground">Max. prijs: {eur(filters.priceMax)}</label>
          <input type="range" min={5000} max={45000} step={500} value={filters.priceMax}
            onChange={(e) => set({ priceMax: Number(e.target.value) })} className="accent-primary" />
        </div>
        <div className="flex min-w-[170px] flex-col gap-1">
          <label className="text-xs text-muted-foreground">Max. km: {filters.mileageMax.toLocaleString("nl-NL")}</label>
          <input type="range" min={10000} max={400000} step={5000} value={filters.mileageMax}
            onChange={(e) => set({ mileageMax: Number(e.target.value) })} className="accent-primary" />
        </div>

        <div className="ml-auto flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{resultCount} resultaten</span>
          <Button variant="outline" size="sm" onClick={() => setFilters(defaultFilters)}>Reset</Button>
        </div>
      </div>
    </div>
  );
}
