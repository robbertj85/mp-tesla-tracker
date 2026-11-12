import { ExternalLink } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CHARGING_HISTORY, COMPARE_SHARED_SOURCES, COMPARE_VEHICLES, type CompareVehicle } from "@/lib/comparison";
import type { BrandKey } from "@/lib/brands";
import { sourceLabel } from "@/lib/sources";
import type { Dataset, Listing } from "@/lib/types";
import { cn, eur, km } from "@/lib/utils";
import { KNOWN_TRAP_IDS, soh, TRAP_RE, used } from "@/lib/listing-checks";
import { WISH_MIN_SOH } from "@/lib/wishes";

// Side-by-side comparison of every tracked vehicle: static spec research
// (lib/comparison.ts) next to live stats from each tracker's dataset.

function median(xs: number[]): number | null {
  const v = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

const KM_BANDS: [number, number, string][] = [
  [0, 50_000, "< 50k km"],
  [50_000, 100_000, "50–100k km"],
  [100_000, 150_000, "100–150k km"],
  [150_000, Infinity, "> 150k km"],
];

interface Live {
  n: number;
  price: number | null;
  km: number | null;
  audioTow: number;
  sohN: number;
  sohMed: number | null;
  sohBands: { label: string; n: number; med: number | null }[];
  pick: Listing | null;
}

function liveStats(v: CompareVehicle, data: Dataset): Live {
  const rows = data.listings.filter((l) => used(l) && v.match(l));
  const withSoh = rows.map((l) => ({ l, s: soh(l) })).filter((x): x is { l: Listing; s: number } => x.s != null);
  const rel = (l: Listing) => (l.residualEur ?? 0) / (l.predictedEur || 1);
  const pick = rows
    // A car that may not tow (towKg 0) can't meet the tow-hitch wish; pick on audio alone.
    .filter((l) => l.premium_audio && (l.tow_hitch || v.towKg === 0) && l.predictedEur != null)
    .filter((l) => !TRAP_RE.test(l.title ?? "") && !KNOWN_TRAP_IDS.has(l.id) && (l.mileage_km ?? 0) <= 150_000)
    .filter((l) => { const s = soh(l); return s == null || s >= WISH_MIN_SOH; })
    .sort((a, b) => rel(a) - rel(b))[0] ?? null;
  return {
    n: rows.length,
    price: median(rows.map((l) => l.price_eur!)),
    km: median(rows.map((l) => l.mileage_km ?? NaN)),
    audioTow: rows.filter((l) => l.premium_audio && l.tow_hitch).length,
    sohN: withSoh.length,
    sohMed: median(withSoh.map((x) => x.s)),
    sohBands: KM_BANDS.map(([lo, hi, label]) => {
      const vals = withSoh.filter((x) => (x.l.mileage_km ?? 0) >= lo && (x.l.mileage_km ?? 0) < hi).map((x) => x.s);
      return { label, n: vals.length, med: median(vals) };
    }),
    pick,
  };
}

type Cell = { node: React.ReactNode; num?: number | null };
interface Row {
  label: string;
  hint?: string;
  best?: "max" | "min";
  cell: (v: CompareVehicle, live: Live) => Cell;
}
interface Group { title: string; rows: Row[] }

const dash = <span className="text-muted-foreground">—</span>;
const n0 = (x: number | null | undefined, unit = "") =>
  x == null ? { node: dash, num: null } : { node: `${x.toLocaleString("nl-NL")}${unit}`, num: x };
const txt = (s: string | null | undefined) => ({ node: s ? s : dash });

const GROUPS: Group[] = [
  {
    title: "Ruimte en praktisch",
    rows: [
      { label: "Kofferbak", hint: "achter, banken omhoog. Tesla meet tot het dak, de rest tot de hoedenplank", best: "max", cell: (v) => n0(v.bootL, " L") },
      { label: "Kofferbak max.", hint: "banken plat", best: "max", cell: (v) => n0(v.bootMaxL, " L") },
      { label: "Frunk", hint: "voorbak", best: "max", cell: (v) => (v.frunkL === 0 ? { node: "geen", num: 0 } : n0(v.frunkL, " L")) },
      { label: "Trekgewicht", hint: "geremd; check het kenteken bij de RDW", best: "max",
        cell: (v) => (v.towKg === 0 ? { node: <span className="text-rose-600">niet toegestaan</span>, num: 0 } : n0(v.towKg, " kg")) },
      { label: "Audio", hint: "premium systeem", cell: (v) => txt(v.audio) },
      { label: "Panoramadak", cell: (v) => txt(v.pano) },
    ],
  },
  {
    title: "Accu, bereik en laden",
    rows: [
      { label: "Accu", hint: "bruikbaar (PHEV: bruto)", best: "max", cell: (v) => n0(v.batteryKwh, " kWh") },
      { label: "WLTP", hint: "PHEV: elektrisch", best: "max", cell: (v) => n0(v.wltpKm, " km") },
      { label: "Bereik zomer", hint: "EV Database, gecombineerd, mild weer", best: "max", cell: (v) => n0(v.realSummerKm, " km") },
      { label: "Bereik winter", hint: "EV Database, gecombineerd, koud weer", best: "max", cell: (v) => n0(v.realWinterKm, " km") },
      { label: "Winter snelweg", hint: "EV Database, snelweg, koud weer", best: "max", cell: (v) => n0(v.realWinterHighwayKm, " km") },
      { label: "Snelladen max.", best: "max", cell: (v) => (v.kind === "ev" || v.dcKw ? n0(v.dcKw, " kW") : { node: "geen" }) },
      { label: "10–80% laden", best: "min", cell: (v) => n0(v.dc10to80min, " min") },
      { label: "Warmtepomp", cell: (v) => txt(v.heatPump) },
    ],
  },
  {
    title: "Accu-degradatie",
    rows: [
      {
        label: "SoH in advertenties",
        hint: "mediaan, live uit de tracker",
        best: "max",
        cell: (v, live) =>
          v.kind !== "ev"
            ? { node: <span className="text-muted-foreground">n.v.t.</span> }
            : live.sohMed == null
              ? { node: dash, num: null }
              : { node: <>{live.sohMed.toFixed(1)}% <span className="text-xs text-muted-foreground">({live.sohN}×)</span></>, num: live.sohN >= 10 ? live.sohMed : null },
      },
      ...KM_BANDS.map(([, , label], i): Row => ({
        label: `SoH bij ${label}`,
        best: "max",
        cell: (v, live) => {
          if (v.kind !== "ev") return { node: <span className="text-muted-foreground">n.v.t.</span> };
          const b = live.sohBands[i];
          return b.med == null
            ? { node: dash, num: null }
            : { node: <>{b.med.toFixed(1)}% <span className="text-xs text-muted-foreground">({b.n}×)</span></>, num: b.n >= 3 ? b.med : null };
        },
      })),
      { label: "Uit onderzoek", cell: (v) => ({ node: <span className="text-xs">{v.degradation ?? "—"}</span> }) },
    ],
  },
  {
    title: "Markt nu (live)",
    rows: [
      { label: "Aanbod", hint: "gebruikt, in deze bouwjaren", cell: (_, l) => n0(l.n) },
      { label: "Mediaan prijs", best: "min", cell: (_, l) => ({ node: eur(l.price), num: l.price }) },
      { label: "Mediaan km-stand", cell: (_, l) => ({ node: km(l.km) }) },
      { label: "Met audio + trekhaak", best: "max", cell: (_, l) => n0(l.audioTow) },
      {
        label: "Beste match nu",
        hint: `audio + trekhaak, ≤ 150k km, SoH ≥ ${WISH_MIN_SOH}% of onbekend, laagst t.o.v. prijsmodel`,
        cell: (_, l) => {
          const p = l.pick;
          if (!p) return { node: <span className="text-xs text-muted-foreground">geen match</span> };
          const pct = ((p.residualEur ?? 0) / (p.predictedEur || 1)) * 100;
          const s = soh(p);
          return {
            node: (
              <a href={p.url} target="_blank" rel="noreferrer" className="group block text-xs">
                <span className="font-medium text-foreground group-hover:underline">
                  {eur(p.price_eur)} <ExternalLink className="inline h-3 w-3" />
                </span>
                <span className="block text-muted-foreground">
                  {p.year} · {km(p.mileage_km)}{s != null ? ` · SoH ${s}%` : ""}
                </span>
                <span className={cn("block", pct < 0 ? "text-emerald-600" : "text-muted-foreground")}>
                  {pct >= 0 ? "+" : "−"}{Math.abs(pct).toFixed(0)}% t.o.v. model
                </span>
                <span className="block truncate text-muted-foreground" title={p.title}>
                  {p.seller_name ?? sourceLabel(p.source)}
                </span>
              </a>
            ),
          };
        },
      },
    ],
  },
  {
    title: "Bouwjaren",
    rows: [
      { label: "Upgrades", cell: (v) => ({ node: <span className="text-xs">{v.upgrades}</span> }) },
      { label: "Let op", cell: (v) => ({ node: <span className="text-xs">{v.note ?? "—"}</span> }) },
    ],
  },
];

function bestIndex(cells: Cell[], best?: "max" | "min"): Set<number> {
  if (!best) return new Set();
  const nums = cells.map((c) => c.num).filter((x): x is number => x != null);
  if (nums.length < 2) return new Set();
  const target = best === "max" ? Math.max(...nums) : Math.min(...nums);
  return new Set(cells.flatMap((c, i) => (c.num === target ? [i] : [])));
}

export function ComparisonView({ datasets }: { datasets: Partial<Record<BrandKey, Dataset>> }) {
  const vehicles = COMPARE_VEHICLES.filter((v) => datasets[v.dataset]);
  const lives = vehicles.map((v) => liveStats(v, datasets[v.dataset]!));
  const sources = [
    ...COMPARE_SHARED_SOURCES.map((s) => ({ ...s, car: "Accu-degradatie" })),
    ...vehicles.flatMap((v) => v.sources.map((s) => ({ ...s, car: v.name }))),
  ];

  return (
    <div className="space-y-6">
      <p className="max-w-3xl text-sm text-muted-foreground">
        Alle getrackte auto&apos;s naast elkaar. Ruimte, audio, bereik en laden komen uit fabrieksopgaven en EV Database
        (onderzocht november 2026). Accugezondheid en marktcijfers komen live uit de tracker. De beste waarde per regel is
        groen. Ruimtecijfers meet elk merk anders, dus kleine verschillen zeggen weinig.
      </p>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Vergelijking</CardTitle>
          <CardDescription>Scroll horizontaal op een smal scherm; de eerste kolom blijft staan.</CardDescription>
        </CardHeader>
        <CardContent className="px-0 pb-2">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] table-fixed border-separate border-spacing-0 text-[13px] leading-snug">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 w-52 border-b bg-card px-3 py-2 text-left align-bottom text-xs font-medium text-muted-foreground">
                    Model
                  </th>
                  {vehicles.map((v) => (
                    <th key={v.id} className="border-b px-2 py-2 text-left align-bottom">
                      <div className="font-semibold">{v.name}</div>
                      <div className="text-xs font-normal text-muted-foreground">{v.years}</div>
                      <Badge variant={v.kind === "ev" ? "good" : "secondary"} className="mt-1">
                        {v.kind === "ev" ? "EV" : v.kind === "phev" ? "PHEV" : "Benzine"}
                      </Badge>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {GROUPS.map((g) => (
                  <Group key={g.title} group={g} vehicles={vehicles} lives={lives} />
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <ChargingHistory />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bronnen</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-1 text-sm sm:grid-cols-2">
            {sources.map((s) => (
              <li key={s.car + s.url}>
                <a href={s.url} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1 text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
                  <span className="font-medium text-foreground">{s.car}:</span> {s.label} <ExternalLink className="h-3 w-3" />
                </a>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function Group({ group, vehicles, lives }: { group: Group; vehicles: CompareVehicle[]; lives: Live[] }) {
  return (
    <>
      <tr>
        <td colSpan={vehicles.length + 1}
          className="sticky left-0 border-b bg-secondary/60 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {group.title}
        </td>
      </tr>
      {group.rows.map((r) => {
        const cells = vehicles.map((v, i) => r.cell(v, lives[i]));
        const best = bestIndex(cells, r.best);
        return (
          <tr key={r.label}>
            <th scope="row" className="sticky left-0 z-10 border-b bg-card px-3 py-2 text-left align-top font-medium">
              {r.label}
              {r.hint && <div className="text-xs font-normal text-muted-foreground">{r.hint}</div>}
            </th>
            {cells.map((c, i) => (
              <td key={vehicles[i].id}
                className={cn("border-b px-2 py-2 align-top tabular-nums break-words",
                  best.has(i) && "font-semibold text-emerald-600 dark:text-emerald-400")}>
                {c.node}
              </td>
            ))}
          </tr>
        );
      })}
    </>
  );
}

/** DC charging per build period: packs and software changed within a model's
 *  life, so the single figure in the main table only holds for its core years. */
function ChargingHistory() {
  // Fastest among the EVs only — a 25 kWh PHEV filling 10–80% quickly isn't comparable.
  const allMin = CHARGING_HISTORY.filter((m) => !m.phev)
    .flatMap((m) => m.steps.map((s) => s.min10to80)).filter((x): x is number => x != null);
  const fastest = Math.min(...allMin);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Laden per bouwjaar</CardTitle>
        <CardDescription>
          Snelladen veranderde binnen één model door een andere accu of software. Periodes zijn de Nederlandse
          bestelperiodes (EV Database); de kentekendatum kan een paar maanden later zijn, dus check bij een grensgeval
          de bouwmaand. 10–80% geldt bij een snellader die het maximum kan leveren.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-y text-xs text-muted-foreground">
              <tr>
                <th className="px-6 py-2 text-left font-medium">Model</th>
                <th className="px-3 py-2 text-left font-medium">Periode</th>
                <th className="px-3 py-2 text-right font-medium">Accu</th>
                <th className="px-3 py-2 text-right font-medium">Max. DC</th>
                <th className="px-3 py-2 text-right font-medium">10–80%</th>
                <th className="px-6 py-2 text-left font-medium">Opmerking</th>
              </tr>
            </thead>
            <tbody>
              {CHARGING_HISTORY.map((m) =>
                m.steps.map((s, i) => (
                  <tr key={m.model + s.period} className={cn(i === m.steps.length - 1 && "border-b")}>
                    <td className="px-6 py-2 align-top font-medium">{i === 0 ? m.model : ""}</td>
                    <td className="whitespace-nowrap px-3 py-2 align-top">{s.period}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right align-top tabular-nums">
                      {s.batteryKwh != null ? `${s.batteryKwh.toLocaleString("nl-NL")} kWh` : "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right align-top tabular-nums">
                      {s.dcKw != null ? `${s.dcKw} kW` : <span className="text-rose-600">geen</span>}
                    </td>
                    <td className={cn("whitespace-nowrap px-3 py-2 text-right align-top tabular-nums",
                      !m.phev && s.min10to80 === fastest && "font-semibold text-emerald-600 dark:text-emerald-400",
                      s.min10to80 != null && s.min10to80 >= 45 && "text-amber-600 dark:text-amber-400")}>
                      {s.min10to80 != null ? `${s.min10to80} min` : "—"}
                    </td>
                    <td className="px-6 py-2 align-top text-xs text-muted-foreground">
                      {s.note}
                      {s.note && s.source && " · "}
                      {s.source && (
                        <a href={s.source.url} target="_blank" rel="noreferrer"
                          className="inline-flex items-center gap-0.5 underline-offset-2 hover:text-foreground hover:underline">
                          {s.source.label} <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
