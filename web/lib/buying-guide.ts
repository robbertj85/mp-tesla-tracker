// Per-brand buying guide ("Koopgids"): model-year history, trim/pack naming,
// pre-purchase checks and sources. Static research content; the page combines it
// with live tracker stats (prices per variant/year, SoH from ad titles, the
// currently best-priced matches). Researched 2026-11-02 — keep the hedges: some
// facts (Europe-specific timing, pack contents) could not be confirmed.

import type { BrandKey } from "./brands";

export type Verdict = "good" | "warn" | "neutral";

export interface YearStep {
  label: string;
  changes: string[];
  verdict: Verdict;
  verdictText: string;
}

export interface TrimEntry {
  name: string;
  years: string;
  text: string;
}

export interface Source {
  label: string;
  url: string;
}

export interface BuyingGuide {
  intro: string;
  /** Variant values in `trim` compared side by side (price / km / SoH per year). */
  compareVariants: string[];
  /** Variants that count as "the right battery" for the live shortlist. */
  shortlistVariants: string[];
  shortlistTitle: string;
  shortlistNote: string;
  years: YearStep[];
  trims: TrimEntry[];
  trimsNote: string;
  checks: { title: string; text: string }[];
  sources: Source[];
}

export const BUYING_GUIDE: Partial<Record<BrandKey, BuyingGuide>> = {
  "mach-e": {
    intro:
      "Standard Range of Extended Range, welk bouwjaar, en waar je op let bij een occasion. " +
      "Prijzen, kilometerstanden en accugezondheid hieronder komen live uit de tracker (Marktplaats + Gaspedaal).",
    compareVariants: ["Standard Range", "Extended Range", "GT"],
    shortlistVariants: ["Extended Range"],
    shortlistTitle: "Extended Range met B&O — nu het scherpst geprijsd",
    shortlistNote:
      "Gebruikte Extended Range (geen GT) met Bang & Olufsen in de advertentie, gesorteerd op prijs t.o.v. het prijsmodel. " +
      "Trekhaak, panoramadak en SoH staan erbij voor zover de advertentie ze noemt.",
    years: [
      {
        label: "2021",
        changes: [
          "Start in Europa. NMC-accu's: Standard ~68–70 kWh, Extended ~88 kWh bruikbaar.",
          "Nog géén warmtepomp.",
          "Valt onder recall 22S41 (bouw mei 2020 – mei 2022): de accucontactors kunnen oververhitten door snelladen en vol accelereren, met vermogensverlies tot gevolg. Eerst opgelost met software, bij sommige auto's later met een nieuwe junction box.",
        ],
        verdict: "warn",
        verdictText: "Ruim aanbod en goedkoop — vraag de recall-historie op.",
      },
      {
        label: "2022",
        changes: [
          "Kleinere software-updates. Extended Range later met ~91 kWh bruikbaar (exacte bouwjaargrens niet hard bevestigd).",
          "Auto's gebouwd tot mei 2022 vallen nog onder dezelfde recall.",
        ],
        verdict: "warn",
        verdictText: "Vergelijkbaar met 2021; check de recall bij vroege bouw.",
      },
      {
        label: "2023",
        changes: [
          "AWD van 269 naar ~315 pk.",
          "BlueCruise 1.2: handsfree rijden met automatisch van rijstrook wisselen.",
        ],
        verdict: "neutral",
        verdictText: "Weinig aanbod; prijs ligt dicht bij een 2024.",
      },
      {
        label: "okt 2023 · MY23.75",
        changes: [
          "Standard Range krijgt een LFP-accu: 72,6 kWh bruikbaar, WLTP 470 km (was 440).",
          "Snelladen tot 150 kW, 10–80% in 32 min (was 41 min). Standaard tot 100% laden mag.",
        ],
        verdict: "good",
        verdictText: "Duidelijke verbetering voor de Standard Range.",
      },
      {
        label: "2024",
        changes: [
          "Nieuwe, lichtere achtermotor met meer koppel, iets meer bereik en sneller laden (Extended).",
          "Aangekondigd voor de VS; wanneer dit in Europa kwam is niet bevestigd.",
        ],
        verdict: "neutral",
        verdictText: "Lastig te onderscheiden van een late 2023.",
      },
      {
        label: "2025",
        changes: [
          "Warmtepomp standaard op alle versies.",
          "Versnellingspook naar de stuurkolom (“Superstalk”), meer opbergruimte in de middenconsole.",
          "Nieuwe kleuren en velgen.",
        ],
        verdict: "good",
        verdictText: "Beste versie, vooral voor winterverbruik — maar duidelijk duurder.",
      },
    ],
    trims: [
      { name: "Standard Range RWD / AWD", years: "2021–2023", text: "Kleine accu. De RWD is de instapper; AWD heeft dezelfde accu met een tweede motor." },
      { name: "Extended Range RWD / AWD", years: "2021–2023", text: "Grote accu. RWD is de bereikkampioen, AWD de snelste niet-GT (351 pk)." },
      { name: "First Edition", years: "2021", text: "Extended Range AWD, vrijwel volledig uitgerust." },
      { name: "GT", years: "2022+", text: "Extended Range AWD met 487 pk en MagneRide adaptieve demping." },
      { name: "GT Performance Edition", years: "2023", text: "GT met extra koppel, sportstoelen en Brembo-remmen." },
      { name: "Select / Premium", years: "2024+", text: "Nieuwe namen: Select is de basis, Premium is rijker uitgerust en komt met de grote accu." },
      { name: "Rally", years: "2024+", text: "In de VS een pakket op de GT (verhoogd, offroad-look). Of die in Nederland te koop was is onbekend." },
      { name: "Technology Pack (Plus)", years: "2021–2023", text: "Optiepakket. B&O en de 360°-camera zitten meestal in het Technology Pack; het panoramadak was los of in een groter pakket." },
    ],
    trimsNote:
      "De uitvoeringsnamen en pakketinhoud komen deels uit eigen kennis en zijn niet volledig geverifieerd — controleer de uitrusting per auto.",
    checks: [
      { title: "Recall 22S41", text: "Laat de dealer de recall-historie uitdraaien: is de software-update gedaan, en is de junction box vervangen? Geldt voor alle auto's gebouwd tot mei 2022." },
      { title: "Accurapport", text: "Vraag een recent onafhankelijk SoH-rapport (Aviloo of een uitlezing door Ford). Bij de LFP-accu (Standard Range vanaf okt 2023) is de SoH lastiger nauwkeurig uit te lezen; een afwijkend getal kan een meetfout zijn." },
      { title: "Trekgewicht", text: "Check het geregistreerde trekgewicht op het kenteken bij de RDW (“maximum trekken massa geremd”). Indicatie, niet geverifieerd: RWD ~750 kg, AWD ~1.000 kg." },
      { title: "Kofferbak", text: "Ongeveer 400 l achter plus een kleine voorbak — kleiner dan een Model Y of Enyaq." },
      { title: "Winter", text: "Een warmtepomp zit er pas vanaf 2025 standaard in; oudere exemplaren verbruiken in de winter merkbaar meer." },
      { title: "Uitrusting", text: "B&O, trekhaak en panoramadak komen in de tracker uit de advertentie. “Niet vermeld” betekent niet per se afwezig — vraag het na." },
    ],
    sources: [
      { label: "Ford Europe persbericht 2025 (warmtepomp, Superstalk)", url: "https://fordpers.be/content/documents/news/2025/2025-04-16-mustang-mach-e-2025-en.pdf" },
      { label: "EV Database – Standard Range MY23", url: "https://ev-database.org/de/pkw/1753/Ford-Mustang-Mach-E-Standard-Range" },
      { label: "EV Database – Standard Range MY23.75 (LFP)", url: "https://ev-database.org/de/pkw/2034/Ford-Mustang-Mach-E-Standard-Range" },
      { label: "Auto Motor und Sport – modelupdates en LFP", url: "https://www.auto-motor-und-sport.de/elektroauto/ford-mustang-mach-e-modellpflege-facelift-lfp-akkus-batterien/" },
      { label: "NewMobility – update 2024 (VS)", url: "https://newmobility.news/2024/04/10/ford-updates-electric-mustang-mach-e/" },
      { label: "Ford Authority – recall junction box 2021–2022", url: "https://fordauthority.com/2023/10/2021-2022-ford-mustang-mach-e-recalled-over-hvbjb-issue/" },
      { label: "CarComplaints – recall 22S41 vermogensverlies", url: "https://carcomplaints.com/news/2022/ford-mustang-mach-e-suvs-losing-drive-power-recall.shtml" },
    ],
  },
};

/** Brands with a buying guide get the "Koopgids" tab. */
export function hasBuyingGuide(brand: BrandKey): boolean {
  return BUYING_GUIDE[brand] != null;
}
