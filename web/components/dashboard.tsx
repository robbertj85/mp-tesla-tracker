"use client";

import * as React from "react";
import { Activity, Car, Gauge, TrendingUp } from "lucide-react";
import type { Dataset, Listing } from "@/lib/types";
import type { BrandConfig } from "@/lib/brands";
import { SiteHeader } from "@/components/site-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { eur, km } from "@/lib/utils";
import { FilterBar, type Filters, defaultFilters, applyFilters } from "@/components/filter-bar";
import { ScatterPanel } from "@/components/scatter-panel";
import { PriceTrendsChart } from "@/components/price-trends-chart";
import { ListingsTable } from "@/components/listings-table";
import { PriceEstimator } from "@/components/price-estimator";
import { ModelInsight } from "@/components/model-insight";

export function Dashboard({ data, brand }: { data: Dataset; brand: BrandConfig }) {
  // Year bounds default to the actual data range (the facet years), so the
  // dropdowns show real, selectable years.
  const years = data.facets.years;
  const base: Filters = React.useMemo(() => {
    const maxPrice = Math.max(5000, ...data.listings.map((l) => l.price_eur ?? 0));
    return {
      ...defaultFilters,
      yearMin: years[0] ?? 2017,
      yearMax: years[years.length - 1] ?? 2026,
      priceMax: Math.ceil(maxPrice / 5000) * 5000,
    };
  }, [years, data.listings]);
  const [filters, setFilters] = React.useState<Filters>(base);
  const filtered: Listing[] = React.useMemo(
    () => data.listings.filter((l) => applyFilters(l, filters)),
    [data.listings, filters]
  );

  return (
    <div className="container max-w-7xl py-8">
      <SiteHeader brand={brand} active="dashboard"
        subtitle={`${brand.modelsLabel} op Marktplaats · bijgewerkt ${data.generatedAt} · ${data.summary.count} actieve advertenties`} />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard icon={<Car className="h-4 w-4" />} label="Actieve auto's" value={String(data.summary.count)}
          sub={Object.entries(data.summary.byModel).map(([m, n]) => `${m}: ${n}`).join(" · ")} />
        <StatCard icon={<TrendingUp className="h-4 w-4" />} label="Mediaan prijs" value={eur(data.summary.medianPriceEur)} />
        <StatCard icon={<Gauge className="h-4 w-4" />} label="Gem. km-stand" value={km(data.summary.avgMileageKm)} />
        <StatCard icon={<Activity className="h-4 w-4" />} label="Model nauwkeurigheid"
          value={data.metrics.linear_r2 != null ? `R² ${data.metrics.linear_r2}` : "—"}
          sub={data.metrics.linear_mae != null ? `± ${eur(data.metrics.linear_mae)} MAE · n=${data.metrics.n}` : data.metrics.note} />
      </div>

      <FilterBar data={data} brand={brand} filters={filters} setFilters={setFilters} resetTo={base} resultCount={filtered.length} />

      <Tabs defaultValue="scatter" className="mt-6">
        <TabsList>
          <TabsTrigger value="scatter">Spreidingsdiagram</TabsTrigger>
          <TabsTrigger value="trends">Prijsontwikkeling</TabsTrigger>
          <TabsTrigger value="listings">Advertenties ({filtered.length})</TabsTrigger>
          <TabsTrigger value="estimator">Prijs schatten</TabsTrigger>
          <TabsTrigger value="insight">Model-inzicht</TabsTrigger>
        </TabsList>

        <TabsContent value="scatter">
          <ScatterPanel listings={filtered} brand={brand} />
        </TabsContent>
        <TabsContent value="trends">
          <PriceTrendsChart trends={data.priceTrends} />
        </TabsContent>
        <TabsContent value="listings">
          <ListingsTable listings={filtered} history={data.priceHistory} brand={brand} />
        </TabsContent>
        <TabsContent value="estimator">
          <PriceEstimator data={data} brand={brand} />
        </TabsContent>
        <TabsContent value="insight">
          <ModelInsight data={data} brand={brand} />
        </TabsContent>
      </Tabs>

      <footer className="mt-10 text-xs text-muted-foreground">
        {brand.dimensions.hw
          ? "HW3/HW4 is deels afgeleid uit bouwjaar en model (zie betrouwbaarheidslabel). FSD, trim en accugezondheid komen uit de advertentietekst en kunnen ontbreken."
          : "Alleen stationwagons (Combi) met automaat, benzine of plug-in hybride (PHEV) vanaf bouwjaar 2019. Brandstof, transmissie en aandrijving komen uit de Marktplaats-kenmerken."}
      </footer>
    </div>
  );
}

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <span className="text-muted-foreground">{icon}</span>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}
