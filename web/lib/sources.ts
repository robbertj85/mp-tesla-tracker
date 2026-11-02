// Display names for the listing sources the scraper merges into one dataset.

export const SOURCE_LABELS: Record<string, string> = {
  marktplaats: "Marktplaats",
  gaspedaal: "Gaspedaal",
  tesla: "Tesla.com",
};

export function sourceLabel(source: string | null | undefined): string {
  const s = source ?? "marktplaats";
  return SOURCE_LABELS[s] ?? s;
}

/** "Marktplaats + Gaspedaal" etc. — the sources actually present in a dataset. */
export function sourcesPhrase(sources: string[] | undefined): string {
  const list = sources?.length ? sources : ["marktplaats"];
  const order = Object.keys(SOURCE_LABELS);
  return [...list]
    .sort((a, b) => order.indexOf(a) - order.indexOf(b))
    .map(sourceLabel)
    .join(" + ");
}

/** Tooltip for a listing's external link. */
export function openOnLabel(source: string | null | undefined): string {
  return source === "gaspedaal" ? "Open via Gaspedaal" : `Open op ${sourceLabel(source)}`;
}
