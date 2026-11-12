"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ChevronUp, ExternalLink, Heart, Star, X } from "lucide-react";
import type { BrandKey } from "@/lib/brands";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn, eur, km } from "@/lib/utils";
import { openOnLabel } from "@/lib/sources";
import { useFavorites } from "@/lib/use-favorites";
import { NEAR_MIN_SOH, WISH_MIN_SOH } from "@/lib/wishes";

/** One ad on /wensen: slimmed down server-side so the page stays small. */
export interface WishRow {
  id: string;
  brand: BrandKey;
  model: string;
  variant: string | null;
  url: string;
  title: string;
  source: string | null;
  year: number | null;
  mileageKm: number | null;
  priceEur: number | null;
  predictedEur: number | null;
  residualEur: number | null;
  vsModelPct: number | null;
  distanceKm: number | null;
  city: string | null;
  soh: number | null;
  powerHp: number | null;
  rangeKm: number | null;
  pano: boolean;
  firstSeen: string;
  /** Set on near-misses: the one must-have it just misses ("SoH 87%"). */
  near: string | null;
  wishTitle: string;
}

type SortKey =
  | "model" | "year" | "mileageKm" | "distanceKm" | "priceEur" | "predictedEur"
  | "residualEur" | "vsModelPct" | "soh" | "powerHp" | "rangeKm" | "firstSeen";
type Dir = "asc" | "desc";

// Lower is better for distance, price, km and the deal gap; higher for the rest.
const ASC_FIRST = new Set<SortKey>(["model", "mileageKm", "distanceKm", "priceEur", "predictedEur", "residualEur", "vsModelPct"]);

const LABELS: Record<SortKey, string> = {
  model: "Auto", year: "Jaar", mileageKm: "Km-stand", distanceKm: "Afstand", priceEur: "Vraagprijs",
  predictedEur: "Schatting", residualEur: "Verschil", vsModelPct: "t.o.v. model", soh: "SoH",
  powerHp: "Vermogen", rangeKm: "Actieradius", firstSeen: "Gezien sinds",
};

const nl = (n: number) => Math.round(n).toLocaleString("nl-NL");
const DAY = 86_400_000;

/** Bracket sizes per sort key. Sorting on a bracket ("per 50 km") makes rows within
 *  one bracket tie, so the next key in the chain decides their order. 0 = exact. */
const BRACKETS: Record<SortKey, { steps: number[]; def: number; fmt: (lo: number, hi: number) => string }> = {
  model: { steps: [0], def: 0, fmt: () => "" },
  year: { steps: [0, 2, 3], def: 0, fmt: (lo, hi) => (hi - lo === 1 ? `${lo}` : `${lo}–${hi - 1}`) },
  mileageKm: { steps: [0, 10_000, 25_000, 50_000], def: 25_000, fmt: (lo, hi) => `${nl(lo / 1000)}–${nl(hi / 1000)}k km` },
  distanceKm: { steps: [0, 10, 25, 50, 100], def: 50, fmt: (lo, hi) => `${nl(lo)}–${nl(hi)} km` },
  priceEur: { steps: [0, 1_000, 2_500, 5_000, 10_000], def: 2_500, fmt: (lo, hi) => `€${nl(lo)}–${nl(hi)}` },
  predictedEur: { steps: [0, 2_500, 5_000, 10_000], def: 5_000, fmt: (lo, hi) => `€${nl(lo)}–${nl(hi)}` },
  residualEur: { steps: [0, 1_000, 2_500, 5_000], def: 1_000, fmt: (lo, hi) => `€${nl(lo)} tot €${nl(hi)}` },
  vsModelPct: { steps: [0, 2.5, 5, 10], def: 5, fmt: (lo, hi) => `${lo}% tot ${hi}%` },
  soh: { steps: [0, 1, 2, 5], def: 2, fmt: (lo, hi) => `${lo}–${hi}%` },
  powerHp: { steps: [0, 25, 50, 100], def: 50, fmt: (lo, hi) => `${lo}–${hi} pk` },
  rangeKm: { steps: [0, 25, 50, 100], def: 50, fmt: (lo, hi) => `${lo}–${hi} km` },
  firstSeen: {
    steps: [0, 7, 30], def: 7,
    fmt: (lo, hi) => `${new Date(lo * DAY).toISOString().slice(0, 10)} – ${new Date((hi - 1) * DAY).toISOString().slice(0, 10)}`,
  },
};

const stepLabel = (k: SortKey, step: number) => {
  if (step === 0) return "exact";
  switch (k) {
    case "mileageKm": return `per ${nl(step / 1000)}k km`;
    case "distanceKm": case "rangeKm": return `per ${step} km`;
    case "priceEur": case "predictedEur": case "residualEur": return `per €${nl(step)}`;
    case "vsModelPct": case "soh": return `per ${String(step).replace(".", ",")}%`;
    case "powerHp": return `per ${step} pk`;
    case "year": return `per ${step} jaar`;
    case "firstSeen": return step === 7 ? "per week" : "per maand";
    default: return `per ${step}`;
  }
};

interface SortEntry { key: SortKey; dir: Dir; step: number }

const DEFAULT_SORT: SortEntry[] = [
  { key: "distanceKm", dir: "asc", step: 50 },
  { key: "vsModelPct", dir: "asc", step: 0 },
];

const DISTANCES = [null, 25, 50, 100, 150] as const;
const PRICES = [null, 25_000, 30_000, 35_000, 40_000] as const;

/** A row's sort value: numbers as-is, dates as day numbers, the model name as text. */
function value(r: WishRow, key: SortKey): number | string | null {
  if (key === "firstSeen") return Math.floor(Date.parse(r.firstSeen) / DAY);
  return r[key];
}

/** The bracket a value falls in (its lower bound), or the value itself for exact. */
function bucket(v: number | string, step: number): number | string {
  return typeof v === "number" && step > 0 ? Math.floor(v / step) * step : v;
}

function cmp(a: WishRow, b: WishRow, { key, dir, step }: SortEntry): number {
  const ar = value(a, key), br = value(b, key);
  // Unknown values always sort last, whatever the direction.
  if (ar == null || br == null) return ar == null ? (br == null ? 0 : 1) : -1;
  const av = bucket(ar, step), bv = bucket(br, step);
  const d = typeof av === "string" ? av.localeCompare(bv as string) : (av as number) - (bv as number);
  return dir === "asc" ? d : -d;
}

/** Group heading for a row under the first sort key ("0–50 km"). */
function groupLabel(r: WishRow, { key, step }: SortEntry): string {
  const v = value(r, key);
  if (v == null) return `${LABELS[key]} onbekend`;
  if (typeof v === "string") return v;
  if (step === 0) return key === "year" ? `${v}` : "";
  const lo = Math.floor(v / step) * step;
  return BRACKETS[key].fmt(lo, lo + step);
}

export function WishList({ rows }: { rows: WishRow[] }) {
  const [showNear, setShowNear] = React.useState(false);
  const [models, setModels] = React.useState<Set<string>>(new Set());
  const [maxDist, setMaxDist] = React.useState<number | null>(null);
  const [onlyFav, setOnlyFav] = React.useState(false);
  const [maxPrice, setMaxPrice] = React.useState<number | null>(null);
  // Multi-key sort: array order is the priority. A header click adds that key at
  // the end, or flips its direction if it is already in the chain.
  const [chain, setChain] = React.useState<SortEntry[]>(DEFAULT_SORT);
  const { isFav, toggle: toggleFav } = useFavorites();

  const modelCounts = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) if (showNear || !r.near) m.set(r.model, (m.get(r.model) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [rows, showNear]);
  const nearCount = React.useMemo(() => rows.filter((r) => r.near).length, [rows]);

  const shown = React.useMemo(() => rows
    .filter((r) => showNear || !r.near)
    .filter((r) => models.size === 0 || models.has(r.model))
    .filter((r) => maxDist == null || (r.distanceKm != null && r.distanceKm <= maxDist))
    .filter((r) => maxPrice == null || (r.priceEur != null && r.priceEur <= maxPrice))
    .filter((r) => !onlyFav || isFav(r.id))
    .sort((a, b) => {
      for (const e of chain) { const d = cmp(a, b, e); if (d) return d; }
      return cmp(a, b, { key: "vsModelPct", dir: "asc", step: 0 });
    }),
  [rows, showNear, models, maxDist, maxPrice, onlyFav, isFav, chain]);

  const clickHeader = (k: SortKey) => setChain((prev) => prev.some((e) => e.key === k)
    ? prev.map((e) => (e.key === k ? { ...e, dir: e.dir === "asc" ? "desc" : "asc" } : e))
    : [...prev, { key: k, dir: ASC_FIRST.has(k) ? "asc" : "desc", step: BRACKETS[k].def }]);
  const updateEntry = (idx: number, patch: Partial<SortEntry>) =>
    setChain((prev) => prev.map((e, i) => (i === idx ? { ...e, ...patch } : e)));
  const removeEntry = (idx: number) => setChain((prev) => prev.filter((_, i) => i !== idx));
  const moveUp = (idx: number) => setChain((prev) => {
    if (idx === 0) return prev;
    const next = [...prev];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    return next;
  });
  const primary = chain[0];

  // Group headings under the first sort key: one per bracket, on its first row.
  const groups = React.useMemo(() => {
    const out: ({ label: string; count: number } | null)[] = [];
    if (!primary) return out;
    let last = -1; // index in `out` of the current group's heading
    shown.forEach((r, i) => {
      const label = groupLabel(r, primary);
      const head = last >= 0 ? out[last] : null;
      if (label && head?.label === label) { head.count++; out.push(null); return; }
      out.push(label ? { label, count: 1 } : null);
      if (label) last = i;
    });
    return out;
  }, [shown, primary]);

  const toggleModel = (m: string) => setModels((prev) => {
    const next = new Set(prev);
    if (next.has(m)) next.delete(m); else next.add(m);
    return next;
  });

  const Th = ({ k, className }: { k: SortKey; className?: string }) => {
    const idx = chain.findIndex((e) => e.key === k);
    const e = chain[idx];
    return (
      <th className={cn("px-3 py-2 text-left font-medium", className)}>
        <button type="button" onClick={() => clickHeader(k)}
          title={e ? "Klik om de richting om te draaien" : "Klik om op deze kolom te sorteren (als volgende niveau)"}
          className={cn("inline-flex items-center gap-0.5 whitespace-nowrap hover:text-foreground", e && "text-foreground")}>
          {LABELS[k]}
          {e && (e.dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
          {e && chain.length > 1 && <span className="text-[10px] text-muted-foreground">{idx + 1}</span>}
        </button>
      </th>
    );
  };

  const chip = (on: boolean) => cn(
    "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
    on ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 p-4 text-sm">
          <p className="text-muted-foreground">
            Een ster betekent: premium audio, trekhaak (bij EV&apos;s),
            SoH vanaf {WISH_MIN_SOH}% of onbekend, en geen valkuil in de titel.
            Er is geen grens op kilometerstand. &quot;Bijna&quot; toont ook auto&apos;s die alleen
            een SoH van {NEAR_MIN_SOH}–{WISH_MIN_SOH}% missen.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setShowNear((v) => !v)} aria-pressed={showNear}
              className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                showNear ? "border-amber-500 bg-amber-500 text-white" : "border-amber-300 text-amber-700 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-950")}>
              <Star className="h-3 w-3" />
              Bijna
              <span className="ml-0.5 opacity-70">{nearCount}</span>
            </button>
            <button type="button" onClick={() => setOnlyFav((v) => !v)} aria-pressed={onlyFav} className={chip(onlyFav)}>
              <Heart className={cn("h-3 w-3", onlyFav && "fill-current")} />
              Favorieten
            </button>
            <span className="mx-1 h-4 border-l" />
            <span className="text-xs text-muted-foreground">Afstand</span>
            {DISTANCES.map((d) => (
              <button key={d ?? "all"} type="button" onClick={() => setMaxDist(d)} aria-pressed={maxDist === d} className={chip(maxDist === d)}>
                {d == null ? "Alle" : `≤ ${d} km`}
              </button>
            ))}
            <span className="mx-1 h-4 border-l" />
            <span className="text-xs text-muted-foreground">Prijs</span>
            {PRICES.map((p) => (
              <button key={p ?? "all"} type="button" onClick={() => setMaxPrice(p)} aria-pressed={maxPrice === p} className={chip(maxPrice === p)}>
                {p == null ? "Alle" : `≤ €${p / 1000}k`}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Model</span>
            {modelCounts.map(([m, n]) => (
              <button key={m} type="button" onClick={() => toggleModel(m)} aria-pressed={models.has(m)} className={chip(models.has(m))}>
                {m}
                <span className="ml-0.5 opacity-70">{n}</span>
              </button>
            ))}
            {models.size > 0 && (
              <button type="button" onClick={() => setModels(new Set())} className="text-xs text-muted-foreground underline hover:text-foreground">
                Wis
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2 text-sm">
            <span className="text-muted-foreground">{shown.length} advertenties · sorteer op</span>
            {chain.map((e, idx) => (
              <span key={e.key} className="inline-flex items-center gap-1 rounded-full border bg-secondary py-0.5 pl-2 pr-1 text-xs">
                <span className="text-muted-foreground">{idx + 1}.</span>
                <button type="button" onClick={() => updateEntry(idx, { dir: e.dir === "asc" ? "desc" : "asc" })}
                  className="inline-flex items-center gap-0.5 font-medium" title="Draai de richting om">
                  {LABELS[e.key]}
                  {e.dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                </button>
                {BRACKETS[e.key].steps.length > 1 && (
                  <select value={e.step} onChange={(ev) => updateEntry(idx, { step: Number(ev.target.value) })}
                    aria-label={`Groepering voor ${LABELS[e.key]}`}
                    className="rounded border-0 bg-transparent py-0 pl-1 pr-5 text-xs text-muted-foreground focus:ring-1">
                    {BRACKETS[e.key].steps.map((st) => <option key={st} value={st}>{stepLabel(e.key, st)}</option>)}
                  </select>
                )}
                {idx > 0 && (
                  <button type="button" onClick={() => moveUp(idx)} title="Maak dit een hoger niveau"
                    className="rounded p-0.5 text-muted-foreground hover:text-foreground"><ChevronUp className="h-3 w-3" /></button>
                )}
                <button type="button" onClick={() => removeEntry(idx)} title="Verwijder dit niveau"
                  className="rounded p-0.5 text-muted-foreground hover:text-foreground"><X className="h-3 w-3" /></button>
              </span>
            ))}
            <span className="text-xs text-muted-foreground">
              Klik een kolomkop om een niveau toe te voegen. Binnen een groep (bijv. per 50 km) beslist het volgende niveau.
            </span>
            {(chain.length !== DEFAULT_SORT.length || chain.some((e, i) => JSON.stringify(e) !== JSON.stringify(DEFAULT_SORT[i]))) && (
              <button type="button" onClick={() => setChain(DEFAULT_SORT)} className="text-xs text-muted-foreground underline hover:text-foreground">
                Herstel
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b text-xs text-muted-foreground">
                <tr>
                  <Th k="model" />
                  <Th k="year" />
                  <Th k="mileageKm" />
                  <Th k="distanceKm" />
                  <Th k="priceEur" />
                  <Th k="predictedEur" className="hidden sm:table-cell" />
                  <Th k="residualEur" className="hidden md:table-cell" />
                  <Th k="vsModelPct" />
                  <Th k="soh" className="hidden md:table-cell" />
                  <Th k="powerHp" className="hidden lg:table-cell" />
                  <Th k="rangeKm" className="hidden lg:table-cell" />
                  <Th k="firstSeen" className="hidden lg:table-cell" />
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {shown.map((r, i) => (
                  <React.Fragment key={r.id}>
                  {groups[i] != null && (
                    <tr className="border-b bg-muted/60">
                      <td colSpan={13} className="px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                        {groups[i]!.label}
                        <span className="ml-2 font-normal">{groups[i]!.count} advertenties</span>
                      </td>
                    </tr>
                  )}
                  <tr className="border-b last:border-0 hover:bg-muted/40">
                    <td className="max-w-[180px] px-3 py-2 sm:max-w-[300px]">
                      <div className="flex flex-wrap items-center gap-1.5 font-medium">
                        <span title={r.wishTitle} className={cn("inline-flex", r.near ? "text-amber-300" : "text-amber-500")}>
                          <Star className={cn("h-3.5 w-3.5", !r.near && "fill-current")} />
                        </span>
                        <Link href={`/${r.brand}`} className="hover:underline">{r.model}</Link>
                        {r.variant && <span className="font-normal text-muted-foreground">{r.variant}</span>}
                        {r.near && <Badge variant="warn" title="De enige wens die deze auto net mist">bijna: {r.near}</Badge>}
                        {r.source === "gaspedaal" && (
                          <span className="rounded bg-sky-600 px-1.5 py-0.5 text-[10px] font-semibold leading-tight text-white"
                            title="Dealervoorraad via Gaspedaal.nl">GP</span>
                        )}
                        {r.source === "tesla" && (
                          <span className="rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-semibold leading-tight text-white"
                            title="Officiële Tesla-occasion">Tesla</span>
                        )}
                        {r.pano && <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold leading-tight text-muted-foreground" title="Panoramadak">Pano</span>}
                      </div>
                      <div className="truncate text-xs text-muted-foreground" title={r.title}>{r.title}</div>
                    </td>
                    <td className="px-3 py-2">{r.year ?? "—"}</td>
                    <td className="whitespace-nowrap px-3 py-2">{km(r.mileageKm)}</td>
                    <td className="whitespace-nowrap px-3 py-2">
                      {r.distanceKm != null ? `${r.distanceKm} km` : "—"}
                      {r.city && <div className="text-xs text-muted-foreground">{r.city}</div>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 font-medium">{eur(r.priceEur)}</td>
                    <td className="hidden whitespace-nowrap px-3 py-2 text-muted-foreground sm:table-cell">{eur(r.predictedEur)}</td>
                    <td className="hidden whitespace-nowrap px-3 py-2 md:table-cell">
                      {r.residualEur != null ? `${r.residualEur > 0 ? "+" : r.residualEur < 0 ? "−" : ""}${eur(Math.abs(r.residualEur))}` : "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">
                      {r.vsModelPct != null ? (
                        <Badge variant={r.vsModelPct <= -5 ? "good" : r.vsModelPct < 5 ? "warn" : "bad"}>
                          {r.vsModelPct > 0 ? "+" : ""}{r.vsModelPct.toFixed(1)}%
                        </Badge>
                      ) : "—"}
                    </td>
                    <td className="hidden whitespace-nowrap px-3 py-2 md:table-cell">{r.soh != null ? `${r.soh}%` : "—"}</td>
                    <td className="hidden whitespace-nowrap px-3 py-2 lg:table-cell">{r.powerHp ? `${r.powerHp} pk` : "—"}</td>
                    <td className="hidden whitespace-nowrap px-3 py-2 lg:table-cell">{km(r.rangeKm)}</td>
                    <td className="hidden whitespace-nowrap px-3 py-2 text-muted-foreground lg:table-cell">{r.firstSeen}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right">
                      <button onClick={() => toggleFav(r.id)} aria-label="Favoriet"
                        className={cn("mr-2 inline-flex transition-colors", isFav(r.id) ? "text-rose-500" : "text-muted-foreground hover:text-rose-500")}>
                        <Heart className={cn("h-4 w-4", isFav(r.id) && "fill-current")} />
                      </button>
                      <a href={r.url} target="_blank" rel="noopener noreferrer" title={openOnLabel(r.source)}
                        className="inline-flex text-muted-foreground hover:text-foreground">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </td>
                  </tr>
                  </React.Fragment>
                ))}
                {shown.length === 0 && (
                  <tr><td colSpan={13} className="px-3 py-8 text-center text-muted-foreground">Geen advertenties met deze filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
