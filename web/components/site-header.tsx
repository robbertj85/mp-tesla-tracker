import Link from "next/link";
import { cn } from "@/lib/utils";
import { BRANDS, BRAND_KEYS, type BrandConfig } from "@/lib/brands";
import { hasTrimGuide } from "@/lib/ranges";
import { hasBuyingGuide } from "@/lib/buying-guide";

export function SiteHeader({ brand, subtitle, active }: {
  /** Omitted on cross-brand pages (/vergelijk): no brand selected, no per-brand tabs. */
  brand?: BrandConfig;
  subtitle?: React.ReactNode;
  active: "dashboard" | "modellen" | "uitvoeringen" | "koopgids" | "vergelijk";
}) {
  const navLink = (href: string, label: string, key: string) => (
    <Link
      key={key}
      href={href}
      className={cn(
        "whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
        active === key ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
      )}
    >
      {label}
    </Link>
  );
  return (
    <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0 max-w-full">
        {/* Brand switcher — Tesla and Skoda are tracked entirely separately. */}
        <nav className="mb-1 flex max-w-full items-center gap-1 overflow-x-auto rounded-lg border bg-card p-1">
          {BRAND_KEYS.map((key) => (
            <Link
              key={key}
              href={`/${key}`}
              className={cn(
                "whitespace-nowrap rounded-md px-3 py-1 text-sm font-semibold transition-colors",
                key === brand?.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {BRANDS[key].label}
            </Link>
          ))}
          <Link
            href="/vergelijk"
            className={cn(
              "whitespace-nowrap rounded-md border-l px-3 py-1 text-sm font-semibold transition-colors",
              active === "vergelijk" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Vergelijk
          </Link>
        </nav>
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
          {brand ? `${brand.label} Prijstracker` : "Vergelijk alle modellen"}
        </h1>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {brand && (
        <nav className="flex max-w-full items-center gap-1 overflow-x-auto rounded-lg border bg-card p-1">
          {navLink(`/${brand.key}`, "Dashboard", "dashboard")}
          {navLink(`/${brand.key}/modellen`, "Modellen", "modellen")}
          {hasTrimGuide(brand.key) && navLink(`/${brand.key}/uitvoeringen`, "Uitvoeringen", "uitvoeringen")}
          {hasBuyingGuide(brand.key) && navLink(`/${brand.key}/koopgids`, "Koopgids", "koopgids")}
        </nav>
      )}
    </header>
  );
}
