import { ExternalLink } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BUYING_GUIDE, type Verdict } from "@/lib/buying-guide";
import type { BrandConfig } from "@/lib/brands";
import { openOnLabel, sourceLabel } from "@/lib/sources";
import type { Dataset, Listing } from "@/lib/types";
import { eur, km } from "@/lib/utils";

function median(xs: number[]): number | null {
  const v = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

// Seller-quoted battery health ("SOH 93,5%"), read from the title. Only Tesla
// records carry a parsed soh_percent, so the other EVs fall back to the title.
const SOH_RE = /\bsoh\b\D{0,15}(\d{2}(?:[.,]\d+)?)/i;
function soh(l: Listing): number | null {
  if (l.soh_percent != null) return l.soh_percent <= 1.5 ? l.soh_percent * 100 : l.soh_percent;
  const m = SOH_RE.exec(l.title ?? "");
  if (!m) return null;
  const v = parseFloat(m[1].replace(",", "."));
  return v >= 70 && v <= 100 ? v : null;
}

const used = (l: Listing) => (l.active ?? true) && l.price_eur != null && (l.mileage_km ?? 0) > 1000;

const VERDICT_VARIANT: Record<Verdict, "good" | "warn" | "secondary"> = {
  good: "good", warn: "warn", neutral: "secondary",
};

function Section({ title, description, children }: {
  title: string; description?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

/** Median price / km / SoH per build year × variant, from the live data. */
function VariantByYear({ data, variants }: { data: Dataset; variants: string[] }) {
  const rows = data.listings.filter(used);
  const years = [...new Set(rows.map((l) => l.year).filter((y): y is number => y != null))].sort();
  const cell = (y: number, v: string) => {
    const c = rows.filter((l) => l.year === y && l.trim === v);
    return {
      n: c.length,
      price: median(c.map((l) => l.price_eur!)),
      km: median(c.map((l) => l.mileage_km ?? NaN)),
    };
  };
  const [small, big] = variants;
  return (
    <div className="-mx-6 overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-y text-xs text-muted-foreground">
          <tr>
            <th className="px-6 py-2 text-left font-medium">Bouwjaar</th>
            {variants.map((v) => (
              <th key={v} className="px-3 py-2 text-right font-medium">{v}</th>
            ))}
            <th className="px-6 py-2 text-right font-medium">Meerprijs {big}</th>
          </tr>
        </thead>
        <tbody>
          {years.map((y) => {
            const cells = variants.map((v) => cell(y, v));
            if (cells.every((c) => c.n === 0)) return null;
            const s = cells[0], b = cells[1];
            const premium = s.n >= 3 && b.n >= 3 && s.price != null && b.price != null ? b.price - s.price : null;
            return (
              <tr key={y} className="border-b last:border-0">
                <td className="px-6 py-2.5 font-medium">{y}</td>
                {cells.map((c, i) => (
                  <td key={variants[i]} className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">
                    {c.n ? (
                      <>
                        <div className="font-medium">{eur(c.price)}</div>
                        <div className="text-xs text-muted-foreground">{c.n}× · {km(c.km)}</div>
                      </>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                ))}
                <td className="whitespace-nowrap px-6 py-2.5 text-right tabular-nums">
                  {premium != null ? (premium >= 0 ? "+" : "") + eur(premium) : <span className="text-muted-foreground">—</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="px-6 pt-3 text-xs text-muted-foreground">
        Mediaan vraagprijs van gebruikte auto&apos;s (&gt;1.000 km), met aantal en mediaan km-stand. De meerprijs
        {" "}{big} vs. {small} staat er alleen bij als beide minstens 3 auto&apos;s hebben; let op het verschil in km.
      </p>
    </div>
  );
}

function SohSummary({ data, variants }: { data: Dataset; variants: string[] }) {
  const rows = data.listings.filter(used);
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {variants.map((v) => {
        const vals = rows.filter((l) => l.trim === v).map(soh).filter((x): x is number => x != null);
        const med = median(vals);
        return (
          <div key={v} className="rounded-lg border p-3">
            <div className="text-xs text-muted-foreground">{v}</div>
            <div className="text-xl font-semibold tabular-nums">{med != null ? `${med.toFixed(1)}%` : "—"}</div>
            <div className="text-xs text-muted-foreground">
              {vals.length ? `mediaan SoH · ${vals.length} advertenties · ${Math.min(...vals)}–${Math.max(...vals)}%` : "geen SoH in advertenties"}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Shortlist({ data, variants }: { data: Dataset; variants: string[] }) {
  const picks = data.listings
    .filter((l) => used(l) && variants.includes(l.trim ?? "") && l.premium_audio && l.residualEur != null)
    .sort((a, b) => a.residualEur! - b.residualEur!)
    .slice(0, 10);
  if (!picks.length) return <p className="text-sm text-muted-foreground">Op dit moment geen passende advertenties.</p>;
  return (
    <div className="-mx-6 overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-y text-xs text-muted-foreground">
          <tr>
            <th className="px-6 py-2 text-left font-medium">Auto</th>
            <th className="px-3 py-2 text-right font-medium">Prijs</th>
            <th className="px-3 py-2 text-right font-medium">t.o.v. model</th>
            <th className="px-3 py-2 text-right font-medium">SoH</th>
            <th className="px-6 py-2 text-left font-medium">Waar</th>
          </tr>
        </thead>
        <tbody>
          {picks.map((l) => {
            const s = soh(l);
            return (
              <tr key={l.id} className="border-b align-top last:border-0">
                <td className="px-6 py-2.5">
                  <div className="font-medium">
                    {l.year} {l.trim} {l.drivetrain ?? ""} · {km(l.mileage_km)}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <Badge variant="secondary">B&amp;O</Badge>
                    {l.tow_hitch && <Badge variant="warn">Trekhaak</Badge>}
                    {l.pano && <Badge variant="secondary">Pano</Badge>}
                  </div>
                  <div className="mt-1 max-w-[420px] truncate text-xs text-muted-foreground" title={l.title}>{l.title}</div>
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right font-medium tabular-nums">{eur(l.price_eur)}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">
                  <span className={l.residualEur! < 0 ? "text-emerald-600" : "text-muted-foreground"}>
                    {l.residualEur! < 0 ? "−" : "+"}{eur(Math.abs(l.residualEur!))}
                  </span>
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">{s != null ? `${s}%` : "—"}</td>
                <td className="whitespace-nowrap px-6 py-2.5">
                  <a href={l.url} target="_blank" rel="noreferrer" title={openOnLabel(l.source)}
                    className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
                    {[l.seller_name, l.city].filter(Boolean).join(", ") || sourceLabel(l.source)}
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                  <div className="text-xs text-muted-foreground">{sourceLabel(l.source)}</div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function BuyingGuideView({ data, brand }: { data: Dataset; brand: BrandConfig }) {
  const g = BUYING_GUIDE[brand.key];
  if (!g) {
    return <p className="text-sm text-muted-foreground">Voor {brand.label} is er (nog) geen koopgids.</p>;
  }
  return (
    <div className="space-y-6">
      <p className="max-w-3xl text-sm text-muted-foreground">{g.intro}</p>

      <Section title={`${g.compareVariants[0]} of ${g.compareVariants[1]}?`}
        description="Wat de grote accu op de occasionmarkt extra kost, per bouwjaar — en hoe gezond de accu's zijn.">
        <div className="space-y-5">
          <VariantByYear data={data} variants={g.compareVariants} />
          <SohSummary data={data} variants={g.compareVariants} />
        </div>
      </Section>

      <Section title="Bouwjaren en updates" description="Wat er per modeljaar veranderde in Europa.">
        <ol className="relative space-y-5 border-l pl-5">
          {g.years.map((y) => (
            <li key={y.label} className="relative">
              <span className="absolute -left-[26px] top-1.5 h-2.5 w-2.5 rounded-full bg-primary" />
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{y.label}</span>
                <Badge variant={VERDICT_VARIANT[y.verdict]}>{y.verdictText}</Badge>
              </div>
              <ul className="mt-1.5 list-disc space-y-1 pl-4 text-sm text-muted-foreground">
                {y.changes.map((c) => <li key={c}>{c}</li>)}
              </ul>
            </li>
          ))}
        </ol>
      </Section>

      <Section title="Uitvoeringen en pakketten" description={g.trimsNote}>
        <dl className="grid gap-3 sm:grid-cols-2">
          {g.trims.map((t) => (
            <div key={t.name} className="rounded-lg border p-3">
              <dt className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium">{t.name}</span>
                <span className="text-xs text-muted-foreground">{t.years}</span>
              </dt>
              <dd className="mt-1 text-sm text-muted-foreground">{t.text}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section title="Checklist voor je gaat kijken">
        <ul className="grid gap-3 sm:grid-cols-2">
          {g.checks.map((c) => (
            <li key={c.title} className="rounded-lg border p-3">
              <div className="font-medium">{c.title}</div>
              <p className="mt-1 text-sm text-muted-foreground">{c.text}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section title={g.shortlistTitle} description={g.shortlistNote}>
        <Shortlist data={data} variants={g.shortlistVariants} />
      </Section>

      <Section title="Bronnen">
        <ul className="space-y-1 text-sm">
          {g.sources.map((s) => (
            <li key={s.url}>
              <a href={s.url} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1 text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
                {s.label} <ExternalLink className="h-3 w-3" />
              </a>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
