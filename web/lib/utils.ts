import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function eur(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return "€" + Math.round(n).toLocaleString("nl-NL");
}

export function km(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return Math.round(n).toLocaleString("nl-NL") + " km";
}
