import Link from "next/link";
import { cn } from "@/lib/utils";
import { BRANDS, BRAND_KEYS, type BrandConfig } from "@/lib/brands";

export function SiteHeader({ brand, subtitle, active }: {
  brand: BrandConfig; subtitle?: React.ReactNode; active: "dashboard" | "modellen";
}) {
  const navLink = (href: string, label: string, key: string) => (
    <Link
      key={key}
      href={href}
      className={cn(
        "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
        active === key ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
      )}
    >
      {label}
    </Link>
  );
  return (
    <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div>
        {/* Brand switcher — Tesla and Skoda are tracked entirely separately. */}
        <nav className="mb-1 inline-flex items-center gap-1 rounded-lg border bg-card p-1">
          {BRAND_KEYS.map((key) => (
            <Link
              key={key}
              href={`/${key}`}
              className={cn(
                "rounded-md px-3 py-1 text-sm font-semibold transition-colors",
                key === brand.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {BRANDS[key].label}
            </Link>
          ))}
        </nav>
        <h1 className="text-2xl font-bold tracking-tight">{brand.label} Prijstracker</h1>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      <nav className="flex items-center gap-1 rounded-lg border bg-card p-1">
        {navLink(`/${brand.key}`, "Dashboard", "dashboard")}
        {navLink(`/${brand.key}/modellen`, "Modellen", "modellen")}
      </nav>
    </header>
  );
}
