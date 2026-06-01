"use client";

import * as React from "react";
import { Activity, Car, Gauge, TrendingUp, Github } from "lucide-react";
import type { Dataset, Listing } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { eur, km } from "@/lib/utils";
import { FilterBar, type Filters, defaultFilters, applyFilters } from "@/components/filter-bar";
import { ScatterPanel } from "@/components/scatter-panel";
import { ListingsTable } from "@/components/listings-table";
import { PriceEstimator } from "@/components/price-estimator";
import { ModelInsight } from "@/components/model-insight";

export function Dashboard({ data }: { data: Dataset }) {
  const [filters, setFilters] = React.useState<Filters>(defaultFilters);
  const filtered: Listing[] = React.useMemo(
    () => data.listings.filter((l) => applyFilters(l, filters)),
    [data.listings, filters]
  );

  return (
    <div className="container max-w-7xl py-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tesla Prijstracker</h1>
          <p className="text-sm text-muted-foreground">
            Model 3 &amp; Model Y op Marktplaats · bijgewerkt {data.generatedAt} ·{" "}
            {data.summary.count} actieve advertenties
          </p>
        </div>
        <a
          href="https://www.marktplaats.nl/l/auto-s/tesla/"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <Github className="h-4 w-4" /> bron: Marktplaats
        </a>
      </header>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard icon={<Car className="h-4 w-4" />} label="Actieve auto's" value={String(data.summary.count)}
          sub={Object.entries(data.summary.byModel).map(([m, n]) => `${m}: ${n}`).join(" · ")} />
        <StatCard icon={<TrendingUp className="h-4 w-4" />} label="Mediaan prijs" value={eur(data.summary.medianPriceEur)} />
        <StatCard icon={<Gauge className="h-4 w-4" />} label="Gem. km-stand" value={km(data.summary.avgMileageKm)} />
        <StatCard icon={<Activity className="h-4 w-4" />} label="Model nauwkeurigheid"
          value={data.metrics.linear_r2 != null ? `R² ${data.metrics.linear_r2}` : "—"}
          sub={data.metrics.linear_mae != null ? `± ${eur(data.metrics.linear_mae)} MAE · n=${data.metrics.n}` : data.metrics.note} />
      </div>

      <FilterBar data={data} filters={filters} setFilters={setFilters} resultCount={filtered.length} />

      <Tabs defaultValue="scatter" className="mt-6">
        <TabsList>
          <TabsTrigger value="scatter">Spreidingsdiagram</TabsTrigger>
          <TabsTrigger value="listings">Advertenties ({filtered.length})</TabsTrigger>
          <TabsTrigger value="estimator">Prijs schatten</TabsTrigger>
          <TabsTrigger value="insight">Model-inzicht</TabsTrigger>
        </TabsList>

        <TabsContent value="scatter">
          <ScatterPanel listings={filtered} />
        </TabsContent>
        <TabsContent value="listings">
          <ListingsTable listings={filtered} history={data.priceHistory} />
        </TabsContent>
        <TabsContent value="estimator">
          <PriceEstimator data={data} />
        </TabsContent>
        <TabsContent value="insight">
          <ModelInsight data={data} />
        </TabsContent>
      </Tabs>

      <footer className="mt-10 text-xs text-muted-foreground">
        HW3/HW4 is deels afgeleid uit bouwjaar en model (zie betrouwbaarheidslabel). FSD,
        trim en accugezondheid komen uit de advertentietekst en kunnen ontbreken.
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
