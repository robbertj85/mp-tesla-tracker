"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, ChevronDown, ExternalLink, Heart, History, Sparkles, X } from "lucide-react";
import type { Listing, PricePoint } from "@/lib/types";
import type { BrandConfig } from "@/lib/brands";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn, eur, km } from "@/lib/utils";
import { PriceHistoryChart } from "@/components/price-history-chart";
import { useFavorites } from "@/lib/use-favorites";

type SortKey = "price_eur" | "mileage_km" | "year" | "residualEur" | "distance_km" | "power_hp" | "range_km" | "battery_kwh";
type Dir = "asc" | "desc";
interface SortEntry { key: SortKey; dir: Dir }

// Distance & deal-difference read best ascending (nearest / best deal first);
// price/year/mileage/power read best descending (newest / most first).
const defaultDir = (k: SortKey): Dir => (k === "residualEur" || k === "distance_km" ? "asc" : "desc");
const opp = (d: Dir): Dir => (d === "asc" ? "desc" : "asc");

const dealBadge: Record<string, { variant: "good" | "warn" | "bad"; label: string }> = {
  good_deal: { variant: "good", label: "Koopje" },
  fair: { variant: "warn", label: "Marktconform" },
  overpriced: { variant: "bad", label: "Aan de prijs" },
};

const hwBadge: Record<string, "good" | "warn"> = { high: "good", medium: "warn", low: "warn" };

/** Compare two listings on one key, honouring direction. Unknown distance always
 *  sorts last; other missing numerics fall back to 0. */
function cmpOne(a: Listing, b: Listing, { key, dir }: SortEntry): number {
  const miss = key === "distance_km" ? Infinity : 0;
  const av = (a[key] ?? miss) as number, bv = (b[key] ?? miss) as number;
  if (av === bv) return 0;
  if (av === Infinity) return 1; // unknown distance last, regardless of direction
  if (bv === Infinity) return -1;
  return dir === "asc" ? av - bv : bv - av;
}

export function ListingsTable({ listings, history, brand, generatedAt }: {
  listings: Listing[]; history: Record<string, PricePoint[]>; brand: BrandConfig;
  generatedAt?: string;
}) {
  const teslaCols = brand.dimensions.hw; // Tesla shows HW/FSD; Skoda shows fuel/power
  const showSource = brand.dimensions.source; // Marktplaats vs Tesla.com split
  const rangeCol = brand.dimensions.range;    // WLTP/actual range + SoH (both sources)
  // Enyaq: every car is electric, so the fuel column would read "Electric" 342
  // times. The battery variant is the useful thing to show in its place.
  const batteryCol = brand.dimensions.battery;
  // "New today": first seen on the latest scrape date. Auto-expires next run, when
  // generatedAt advances but first_seen stays — no per-ad toggle to maintain.
  const isNew = (l: Listing) => generatedAt != null && l.first_seen === generatedAt;
  // Multi-key sort: the array order is the priority (first = primary). Clicking a
  // header appends it (lowest priority), then cycles its direction, then drops it.
  // Zero-state by default (and after reset): the rows keep the payload order (best
  // deal first), and the first header you click becomes the primary sort.
  const [sortChain, setSortChain] = React.useState<SortEntry[]>([]);
  const [onlyChanged, setOnlyChanged] = React.useState(false);
  const [onlyFav, setOnlyFav] = React.useState(false);
  const [onlyNew, setOnlyNew] = React.useState(false);
  const [open, setOpen] = React.useState<string | null>(null);
  const { isFav, toggle: toggleFav, count: favCount } = useFavorites();

  const changedCount = React.useMemo(
    () => listings.filter((l) => (history[l.id]?.length ?? 0) > 1).length,
    [listings, history]
  );
  const newCount = React.useMemo(() => listings.filter(isNew).length, [listings, generatedAt]);

  const rows = React.useMemo(() => {
    let base = onlyChanged
      ? listings.filter((l) => (history[l.id]?.length ?? 0) > 1)
      : listings;
    if (onlyFav) base = base.filter((l) => isFav(l.id));
    if (onlyNew) base = base.filter(isNew);
    const arr = [...base];
    arr.sort((a, b) => {
      for (const entry of sortChain) {
        const c = cmpOne(a, b, entry);
        if (c !== 0) return c;
      }
      return 0;
    });
    return arr;
  }, [listings, history, sortChain, onlyChanged, onlyFav, onlyNew, isFav, generatedAt]);

  const cycle = (k: SortKey) => {
    setSortChain((chain) => {
      const i = chain.findIndex((e) => e.key === k);
      if (i === -1) return [...chain, { key: k, dir: defaultDir(k) }]; // add as lowest priority
      const cur = chain[i].dir;
      if (cur === defaultDir(k)) {
        const next = [...chain];
        next[i] = { key: k, dir: opp(cur) }; // 2nd click: flip direction
        return next;
      }
      return chain.filter((e) => e.key !== k); // 3rd click: remove from the chain
    });
  };

  const Th = ({ k, children, className }: { k: SortKey; children: React.ReactNode; className?: string }) => {
    const idx = sortChain.findIndex((e) => e.key === k);
    const entry = idx === -1 ? null : sortChain[idx];
    return (
      <th className={cn("cursor-pointer select-none px-3 py-2 text-left font-medium hover:text-foreground", className)}
        onClick={() => cycle(k)} title="Klik om te sorteren · nogmaals = omkeren · 3e keer = verwijderen">
        <span className="inline-flex items-center gap-1">
          {children}
          {entry && (
            <span className="inline-flex items-center text-foreground">
              {entry.dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
              {sortChain.length > 1 && (
                <span className="ml-0.5 rounded bg-secondary px-1 text-[10px] font-semibold leading-tight text-secondary-foreground">
                  {idx + 1}
                </span>
              )}
            </span>
          )}
        </span>
      </th>
    );
  };

  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setOnlyChanged((v) => !v)}
              className={cn("inline-flex items-center gap-1 rounded-md border px-2 py-1 font-medium transition-colors",
                onlyChanged ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted")}>
              <History className="h-3.5 w-3.5" />
              Alleen prijswijziging ({changedCount})
            </button>
            <button onClick={() => setOnlyFav((v) => !v)}
              className={cn("inline-flex items-center gap-1 rounded-md border px-2 py-1 font-medium transition-colors",
                onlyFav ? "border-rose-500 bg-rose-500 text-white" : "hover:bg-muted")}>
              <Heart className={cn("h-3.5 w-3.5", onlyFav && "fill-current")} />
              Mijn favorieten ({favCount})
            </button>
            {newCount > 0 && (
              <button onClick={() => setOnlyNew((v) => !v)}
                className={cn("inline-flex items-center gap-1 rounded-md border px-2 py-1 font-medium transition-colors",
                  onlyNew ? "border-emerald-600 bg-emerald-600 text-white" : "hover:bg-muted")}>
                <Sparkles className="h-3.5 w-3.5" />
                Nieuw vandaag ({newCount})
              </button>
            )}
            <span className="text-muted-foreground">
              {rows.length} {rows.length === 1 ? "advertentie" : "advertenties"}
            </span>
          </div>
          {sortChain.length > 0 && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="hidden sm:inline">
                Sortering: {sortChain.map((e, i) => `${i + 1}. ${SORT_LABELS[e.key]} ${e.dir === "asc" ? "↑" : "↓"}`).join(" · ")}
              </span>
              <button onClick={() => setSortChain([])}
                className="inline-flex items-center gap-1 rounded-md border px-2 py-1 font-medium hover:bg-muted">
                <X className="h-3 w-3" /> Reset
              </button>
            </div>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Auto</th>
                <Th k="year">Jaar</Th>
                <Th k="mileage_km">Km-stand</Th>
                <Th k="distance_km" className="hidden md:table-cell">Afstand</Th>
                {teslaCols ? (
                  <>
                    <th className="hidden px-3 py-2 text-left font-medium lg:table-cell">HW</th>
                    <th className="hidden px-3 py-2 text-left font-medium lg:table-cell">FSD</th>
                  </>
                ) : (
                  <>
                    {batteryCol
                      ? <Th k="battery_kwh" className="hidden md:table-cell">Accu</Th>
                      : <th className="hidden px-3 py-2 text-left font-medium md:table-cell">Brandstof</th>}
                    <Th k="power_hp" className="hidden lg:table-cell">Vermogen</Th>
                  </>
                )}
                {rangeCol && <Th k="range_km" className="hidden lg:table-cell">Actieradius</Th>}
                <Th k="price_eur">Vraagprijs</Th>
                <th className="hidden px-3 py-2 text-left font-medium sm:table-cell">Schatting</th>
                <Th k="residualEur">Verschil</Th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => {
                const deal = l.dealLabel ? dealBadge[l.dealLabel] : null;
                const hist = history[l.id];
                const changed = hist && hist.length > 1;
                const isOpen = open === l.id;
                return (
                  <React.Fragment key={l.id}>
                    <tr className="border-b last:border-0 hover:bg-muted/40">
                      <td className="max-w-[160px] px-3 py-2 sm:max-w-[260px]">
                        <div className="flex flex-wrap items-center gap-1.5 font-medium">
                          <span>{l.model} {l.trim ?? ""}</span>
                          {isNew(l) && (
                            <span className="inline-flex items-center gap-0.5 rounded bg-emerald-600 px-1.5 py-0.5 text-[10px] font-semibold leading-tight text-white"
                              title={`Nieuw geplaatst op ${l.first_seen}`}>
                              <Sparkles className="h-2.5 w-2.5" />Nieuw
                            </span>
                          )}
                          {showSource && l.source === "tesla" && (
                            <span className="rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-semibold leading-tight text-white"
                              title="Officiële Tesla-occasion">Tesla</span>
                          )}
                          {l.tow_hitch && (
                            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold leading-tight text-amber-800"
                              title="Trekhaak aanwezig">Trekhaak</span>
                          )}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">{l.color ?? ""} · {l.city ?? ""}</div>
                      </td>
                      <td className="px-3 py-2">{l.year ?? "—"}</td>
                      <td className="px-3 py-2">{km(l.mileage_km)}</td>
                      <td className="hidden whitespace-nowrap px-3 py-2 md:table-cell">
                        {l.distance_km != null ? `${l.distance_km} km` : "—"}
                      </td>
                      {teslaCols ? (
                        <>
                          <td className="hidden px-3 py-2 lg:table-cell">
                            {l.hw_platform ? (
                              <Badge variant={l.hw_confidence ? hwBadge[l.hw_confidence] ?? "warn" : "warn"}>
                                {l.hw_platform}{l.hw_source === "inferred" ? "*" : ""}
                              </Badge>
                            ) : "—"}
                          </td>
                          <td className="hidden px-3 py-2 lg:table-cell">{l.fsd ? <Badge variant="good">FSD</Badge> :
                            l.autopilot_package === "eap" ? <Badge variant="secondary">EAP</Badge> : "—"}</td>
                        </>
                      ) : (
                        <>
                          <td className="hidden whitespace-nowrap px-3 py-2 md:table-cell">
                            {batteryCol ? (
                              l.trim ? (
                                <span className="flex items-center gap-1.5">
                                  <Badge variant="secondary">{l.trim}</Badge>
                                  {l.battery_kwh != null && (
                                    <span className="text-xs text-muted-foreground">{l.battery_kwh} kWh</span>
                                  )}
                                </span>
                              ) : "—"
                            ) : l.fuel ? (
                              <Badge variant={l.fuel === "PHEV" ? "good" : "secondary"}>{l.fuel}</Badge>
                            ) : "—"}
                          </td>
                          <td className="hidden whitespace-nowrap px-3 py-2 lg:table-cell">{l.power_hp ? `${l.power_hp} pk` : "—"}</td>
                        </>
                      )}
                      {rangeCol && (
                        <td className="hidden whitespace-nowrap px-3 py-2 lg:table-cell">
                          {l.range_km != null ? (
                            <span title={(l.source ?? "marktplaats") === "tesla"
                              ? "Actieradius zoals Tesla.com die per auto opgeeft (ActualRange)"
                              : "WLTP-fabrieksopgave (actieradius als nieuw), niet de actuele gemeten waarde"}>
                              {km(l.range_km)}
                              <span className="ml-1 text-[10px] uppercase text-muted-foreground">
                                {(l.source ?? "marktplaats") === "tesla" ? "Tesla" : "WLTP"}
                              </span>
                            </span>
                          ) : "—"}
                          {l.rangePct != null && l.wltpEst != null && (
                            <span className={cn("ml-1 text-xs", l.rangePct >= 90 ? "text-emerald-600" : l.rangePct >= 80 ? "text-amber-600" : "text-red-600")}
                              title={`Schatting: ${l.rangePct}% van de originele WLTP (±${l.wltpEst} km, beste in deze uitvoering)`}>
                              ~{l.rangePct}% v. {l.wltpEst} WLTP
                            </span>
                          )}
                          {l.soh_percent != null && (
                            <span className="ml-1 text-xs text-emerald-600" title="Accugezondheid uit de advertentietekst">
                              {l.soh_percent}% SoH
                            </span>
                          )}
                        </td>
                      )}
                      <td className="px-3 py-2">
                        <span className="font-medium">{eur(l.price_eur)}</span>
                        {changed && <PriceChange points={hist!} current={l.price_eur} />}
                      </td>
                      <td className="hidden px-3 py-2 text-muted-foreground sm:table-cell">{eur(l.predictedEur)}</td>
                      <td className="px-3 py-2">
                        {deal && l.residualEur != null ? (
                          <Badge variant={deal.variant}>{l.residualEur > 0 ? "+" : ""}{eur(l.residualEur)}</Badge>
                        ) : "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right">
                        <button onClick={() => toggleFav(l.id)}
                          className={cn("mr-2 inline-flex transition-colors",
                            isFav(l.id) ? "text-rose-500" : "text-muted-foreground hover:text-rose-500")}
                          title={isFav(l.id) ? "Verwijder uit favorieten" : "Markeer als favoriet"}
                          aria-pressed={isFav(l.id)}>
                          <Heart className={cn("h-4 w-4", isFav(l.id) && "fill-current")} />
                        </button>
                        {changed && (
                          <button onClick={() => setOpen(isOpen ? null : l.id)}
                            className="mr-2 inline-flex text-muted-foreground hover:text-foreground" title="Prijsverloop">
                            <History className="h-4 w-4" />
                          </button>
                        )}
                        <a href={l.url} target="_blank" rel="noreferrer"
                          className="inline-flex text-muted-foreground hover:text-foreground"
                          title={l.source === "tesla" ? "Open op Tesla.com" : "Open op Marktplaats"}>
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </td>
                    </tr>
                    {isOpen && hist && (
                      <tr className="border-b bg-muted/30">
                        <td colSpan={11} className="px-4 py-3">
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
          {rangeCol && "Actieradius: Marktplaats toont de WLTP-fabrieksopgave (als nieuw), Tesla.com de per-auto opgegeven actieradius. Het percentage zet die actieradius af tegen de originele WLTP voor model/uitvoering/bouwjaar (ruwe accuconditie-schatting). SoH% komt uit de advertentietekst. "}
          Verschil = vraagprijs − modelschatting.
          Afstand is gemeten vanaf postcode 3051 (Rotterdam).
          Klik kolomkoppen om te sorteren; meerdere kolommen stapelen (cijfer = prioriteit).
        </p>
      </CardContent>
    </Card>
  );
}

const SORT_LABELS: Record<SortKey, string> = {
  year: "Jaar", mileage_km: "Km-stand", distance_km: "Afstand",
  power_hp: "Vermogen", price_eur: "Vraagprijs", residualEur: "Verschil",
  battery_kwh: "Accu",
  range_km: "Actieradius",
};

/** Inline note of the earlier asking price(s) — only rendered when the price moved.
 *  Shows the net change vs the original and the full struck-through earlier trail. */
function PriceChange({ points, current }: { points: PricePoint[]; current: number | null }) {
  const earlier = points.slice(0, -1); // every point before the current one
  if (!earlier.length || current == null) return null;
  const original = earlier[0].priceEur;
  const delta = current - original;
  const dropped = delta < 0; // cheaper now = good for a buyer
  const trail = earlier.map((p) => eur(p.priceEur)).join(" → ");
  return (
    <div className="mt-0.5 text-xs">
      <span className={cn("font-medium", dropped ? "text-emerald-600" : "text-red-600")}>
        {dropped ? "▼" : "▲"} {eur(Math.abs(delta))}
      </span>{" "}
      <span className="text-muted-foreground line-through">{trail}</span>
    </div>
  );
}
