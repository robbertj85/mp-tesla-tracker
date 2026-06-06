"use client";

import * as React from "react";

// Liked listings live in the browser (no backend). One shared key across all
// brand dashboards; listing ids are globally unique (Marktplaats "m…" / Tesla
// "tesla-<VIN>"), so a single set is safe.
const KEY = "mp-tesla:favorites";

function load(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? new Set<string>(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

export function useFavorites() {
  // Start empty so server and first client render match; hydrate in an effect.
  const [favs, setFavs] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    setFavs(load());
    // Keep multiple tabs in sync.
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setFavs(load());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const toggle = React.useCallback((id: string) => {
    setFavs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        window.localStorage.setItem(KEY, JSON.stringify([...next]));
      } catch {
        /* ignore quota / private-mode errors */
      }
      return next;
    });
  }, []);

  return {
    favs,
    isFav: React.useCallback((id: string) => favs.has(id), [favs]),
    toggle,
    count: favs.size,
  };
}
