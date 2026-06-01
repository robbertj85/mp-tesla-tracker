import Link from "next/link";
import { cn } from "@/lib/utils";

export function SiteHeader({ subtitle, active }: { subtitle?: React.ReactNode; active: "dashboard" | "modellen" }) {
  const link = (href: string, label: string, key: string) => (
    <Link
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
        <h1 className="text-2xl font-bold tracking-tight">Tesla Prijstracker</h1>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      <nav className="flex items-center gap-1 rounded-lg border bg-card p-1">
        {link("/", "Dashboard", "dashboard")}
        {link("/modellen", "Modellen", "modellen")}
      </nav>
    </header>
  );
}
