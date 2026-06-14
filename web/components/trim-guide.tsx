import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TRIM_GUIDE, type ModelTrims, type TrimSpec } from "@/lib/ranges";
import type { Dataset } from "@/lib/types";
import type { BrandConfig } from "@/lib/brands";
import { km } from "@/lib/utils";

function median(xs: number[]): number | null {
  const v = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

/** Median measured battery health for a model, from the live tracker data:
 *  Tesla.com cars carry rangePct (rated range ÷ as-new WLTP); otherwise fall
 *  back to seller-reported soh_percent. */
function measuredHealth(data: Dataset, model: string) {
  const rows = data.listings.filter((l) => l.model === model && (l.active ?? true));
  const pct = rows.map((l) => l.rangePct).filter((x): x is number => x != null && x > 0);
  const soh = rows
    .map((l) => l.soh_percent)
    .filter((x): x is number => x != null)
    .map((x) => (x <= 1.5 ? x * 100 : x));
  const pool = pct.length >= soh.length ? pct : soh;
  return { value: median(pool), n: pool.length, basis: pct.length >= soh.length ? "rated range" : "opgegeven SoH" };
}

function RangeBar({ t, max }: { t: TrimSpec; max: number }) {
  const pct = (x: number) => `${Math.min(100, (x / max) * 100).toFixed(1)}%`;
  return (
    <div className="relative h-2.5 w-full min-w-[120px] rounded-full bg-secondary" title="WLTP · praktijk · winter">
      <div className="absolute inset-y-0 left-0 rounded-full bg-muted-foreground/30" style={{ width: pct(t.range.wltp) }} />
      <div className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: pct(t.range.real) }} />
      <div className="absolute inset-y-[-2px] w-[2px] rounded bg-foreground/80" style={{ left: pct(t.range.winter) }} />
    </div>
  );
}

function ModelCard({ m, max, data }: { m: ModelTrims; max: number; data: Dataset }) {
  const health = measuredHealth(data, m.model);
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <CardTitle>{m.model}</CardTitle>
          {health.value != null && (
            <span className="text-xs text-muted-foreground">
              In de tracker: batterijgezondheid mediaan{" "}
              <span className="font-semibold text-foreground">{Math.round(health.value)}%</span>{" "}
              ({health.n} advertenties · {health.basis})
            </span>
          )}
        </div>
        <CardDescription>{m.blurb}</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-y text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Uitvoering</th>
                <th className="px-3 py-2 text-left font-medium">Aandrijving</th>
                <th className="px-3 py-2 text-left font-medium">Jaren</th>
                <th className="px-3 py-2 text-right font-medium">Accu</th>
                <th className="px-3 py-2 text-right font-medium">WLTP</th>
                <th className="px-3 py-2 text-right font-medium">Praktijk</th>
                <th className="px-3 py-2 text-right font-medium">Winter</th>
                <th className="px-3 py-2 text-right font-medium">Snelweg 110</th>
                <th className="px-4 py-2 text-left font-medium">Bereik (WLTP / praktijk / winter)</th>
              </tr>
            </thead>
            <tbody>
              {m.trims.map((t) => (
                <tr key={t.trim} className="border-b last:border-0 align-top">
                  <td className="px-4 py-2.5">
                    <div className="font-medium">{t.trim}</div>
                    {t.note && <div className="mt-0.5 text-xs text-muted-foreground">{t.note}</div>}
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge variant={t.drivetrain === "AWD" ? "default" : "secondary"}>{t.drivetrain}</Badge>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">{t.years}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                    {t.batteryKwh ? `${t.batteryKwh} kWh` : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-medium">{km(t.range.wltp)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {km(t.range.real)}
                    {t.range.bron === "schatting" && <span className="text-muted-foreground">*</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{km(t.range.winter)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                    {t.range.highwayCold ? `${km(t.range.highwayCold)}–${km(t.range.highwaySummer!)}` : "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <RangeBar t={t} max={max} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

export function TrimGuide({ data, brand }: { data: Dataset; brand: BrandConfig }) {
  const models = TRIM_GUIDE[brand.key];
  if (!models) {
    return (
      <p className="text-sm text-muted-foreground">
        Voor {brand.label} houden we (nog) geen uitvoering- en bereikoverzicht bij.
      </p>
    );
  }
  const max = Math.max(...models.flatMap((m) => m.trims.map((t) => t.range.wltp)));
  const hasEst = models.some((m) => m.trims.some((t) => t.range.bron === "schatting"));

  return (
    <div className="space-y-6">
      {/* Legend + how to read */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-muted-foreground">
            <span className="inline-flex items-center gap-2">
              <span className="h-2.5 w-6 rounded-full bg-muted-foreground/30" /> WLTP (nieuw)
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-2.5 w-6 rounded-full bg-primary" /> Praktijk (jaarrond)
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-3 w-[2px] bg-foreground/80" /> Winter (−10 °C)
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Praktijkcijfers: EV Database Real Range; <span className="font-medium">*</span> = schatting (~0,80× WLTP).
            Bereik daalt ±20% in praktijk en tot ~⅓ in de winter / op de snelweg.
          </p>
        </CardContent>
      </Card>

      {models.map((m) => (
        <ModelCard key={m.model} m={m} max={max} data={data} />
      ))}

      {/* RWD vs Long Range AWD — the SoH break-even, embedded from the analysis. */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">RWD vs. Long Range AWD — wanneer is RWD-bereik vergelijkbaar?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Bruikbaar bereik ≈ <span className="font-medium text-foreground">WLTP-nieuw × batterijgezondheid</span>.
            Een Long Range AWD start met 12–25% méér WLTP dan de RWD, dus zelfs een RWD op 100% gezondheid evenaart
            pas een Long Range die zélf is gezakt naar ongeveer{" "}
            <span className="font-medium text-foreground">~77–80% (Model 3)</span> of{" "}
            <span className="font-medium text-foreground">~85% (Model Y)</span>.
          </p>
          <p>
            In de huidige occasionvoorraad zit vrijwel geen Long Range AWD zó laag (mediaan ~91–92%, minimum ~81–86%).
            Een RWD kies je dus op prijs (~€3–4,5k goedkoper), niet op bereik: bij gelijke gezondheid rijdt de Long
            Range AWD ~15–25% verder.
          </p>
          {hasEst && (
            <p className="text-xs">* WLTP uit de scraper-tabel (bron: EV Database); praktijkschattingen waar geen meetcijfer beschikbaar is.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
