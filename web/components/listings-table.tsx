"use client";

import * as React from "react";
import { ChevronDown, ExternalLink, History } from "lucide-react";
import type { Listing, PricePoint } from "@/lib/types";
import type { BrandConfig } from "@/lib/brands";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn, eur, km } from "@/lib/utils";
import { PriceHistoryChart } from "@/components/price-history-chart";

type SortKey = "price_eur" | "mileage_km" | "year" | "residualEur" | "distance_km";

const dealBadge: Record<string, { variant: "good" | "warn" | "bad"; label: string }> = {
  good_deal: { variant: "good", label: "Koopje" },
  fair: { variant: "warn", label: "Marktconform" },
  overpriced: { variant: "bad", label: "Aan de prijs" },
};

const hwBadge: Record<string, "good" | "warn"> = { high: "good", medium: "warn", low: "warn" };

export function ListingsTable({ listings, history, brand }: {
  listings: Listing[]; history: Record<string, PricePoint[]>; brand: BrandConfig;
}) {
  const teslaCols = brand.dimensions.hw; // Tesla shows HW/FSD; Skoda shows fuel/power
  const [sort, setSort] = React.useState<SortKey>("residualEur");
  const [asc, setAsc] = React.useState(true);
  const [open, setOpen] = React.useState<string | null>(null);

  const sorted = React.useMemo(() => {
    const arr = [...listings];
    // Unknown distance sorts last regardless of direction; other nulls -> 0.
    const miss = sort === "distance_km" ? Infinity : 0;
    arr.sort((a, b) => {
      const av = (a[sort] ?? miss) as number, bv = (b[sort] ?? miss) as number;
      if (av === bv) return 0;
      if (av === Infinity) return 1;
      if (bv === Infinity) return -1;
      return asc ? av - bv : bv - av;
    });
    return arr;
  }, [listings, sort, asc]);

  const toggle = (k: SortKey) => {
    if (k === sort) setAsc(!asc);
    // Distance & deal-difference read best ascending (nearest / best deal first).
    else { setSort(k); setAsc(k === "residualEur" || k === "distance_km"); }
  };

  const Th = ({ k, children, className }: { k: SortKey; children: React.ReactNode; className?: string }) => (
    <th className={cn("cursor-pointer select-none px-3 py-2 text-left font-medium hover:text-foreground", className)}
      onClick={() => toggle(k)}>
      <span className="inline-flex items-center gap-1">{children}{sort === k && <ChevronDown className={cn("h-3 w-3 transition", !asc && "rotate-180")} />}</span>
    </th>
  );

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Auto</th>
                <Th k="year">Jaar</Th>
                <Th k="mileage_km">Km-stand</Th>
                <Th k="distance_km">Afstand</Th>
                {teslaCols ? (
                  <>
                    <th className="px-3 py-2 text-left font-medium">HW</th>
                    <th className="px-3 py-2 text-left font-medium">FSD</th>
                  </>
                ) : (
                  <>
                    <th className="px-3 py-2 text-left font-medium">Brandstof</th>
                    <th className="px-3 py-2 text-left font-medium">Vermogen</th>
                  </>
                )}
                <Th k="price_eur">Vraagprijs</Th>
                <th className="px-3 py-2 text-left font-medium">Schatting</th>
                <Th k="residualEur">Verschil</Th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((l) => {
                const deal = l.dealLabel ? dealBadge[l.dealLabel] : null;
                const hist = history[l.id];
                const isOpen = open === l.id;
                return (
                  <React.Fragment key={l.id}>
                    <tr className="border-b last:border-0 hover:bg-muted/40">
                      <td className="max-w-[260px] px-3 py-2">
                        <div className="font-medium">{l.model} {l.trim ?? ""}</div>
                        <div className="truncate text-xs text-muted-foreground">{l.color ?? ""} · {l.city ?? ""}</div>
                      </td>
                      <td className="px-3 py-2">{l.year ?? "—"}</td>
                      <td className="px-3 py-2">{km(l.mileage_km)}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {l.distance_km != null ? `${l.distance_km} km` : "—"}
                      </td>
                      {teslaCols ? (
                        <>
                          <td className="px-3 py-2">
                            {l.hw_platform ? (
                              <Badge variant={l.hw_confidence ? hwBadge[l.hw_confidence] ?? "warn" : "warn"}>
                                {l.hw_platform}{l.hw_source === "inferred" ? "*" : ""}
                              </Badge>
                            ) : "—"}
                          </td>
                          <td className="px-3 py-2">{l.fsd ? <Badge variant="good">FSD</Badge> :
                            l.autopilot_package === "eap" ? <Badge variant="secondary">EAP</Badge> : "—"}</td>
                        </>
                      ) : (
                        <>
                          <td className="px-3 py-2">
                            {l.fuel ? <Badge variant={l.fuel === "PHEV" ? "good" : "secondary"}>{l.fuel}</Badge> : "—"}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">{l.power_hp ? `${l.power_hp} pk` : "—"}</td>
                        </>
                      )}
                      <td className="px-3 py-2 font-medium">{eur(l.price_eur)}</td>
                      <td className="px-3 py-2 text-muted-foreground">{eur(l.predictedEur)}</td>
                      <td className="px-3 py-2">
                        {deal && l.residualEur != null ? (
                          <Badge variant={deal.variant}>{l.residualEur > 0 ? "+" : ""}{eur(l.residualEur)}</Badge>
                        ) : "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right">
                        {hist && hist.length > 1 && (
                          <button onClick={() => setOpen(isOpen ? null : l.id)}
                            className="mr-2 inline-flex text-muted-foreground hover:text-foreground" title="Prijsverloop">
                            <History className="h-4 w-4" />
                          </button>
                        )}
                        <a href={l.url} target="_blank" rel="noreferrer"
                          className="inline-flex text-muted-foreground hover:text-foreground" title="Open op Marktplaats">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </td>
                    </tr>
                    {isOpen && hist && (
                      <tr className="border-b bg-muted/30">
                        <td colSpan={10} className="px-4 py-3">
                          <div className="mb-1 text-xs font-medium text-muted-foreground">Prijsverloop</div>
                          <PriceHistoryChart points={hist} />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="px-3 py-2 text-xs text-muted-foreground">
          {teslaCols && "* HW-platform afgeleid (niet expliciet vermeld). "}
          Verschil = vraagprijs − modelschatting.
          Afstand is gemeten vanaf postcode 3051 (Rotterdam).
        </p>
      </CardContent>
    </Card>
  );
}
