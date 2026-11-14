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
  /** Section title for that comparison; defaults to "<first> of <second>?". */
  compareTitle?: string;
  /** The two compareVariants whose per-year price gap is shown ("Meerprijs");
   *  defaults to the first two. */
  premiumPair?: [string, string];
  /** Badge on shortlist cars for the premium audio system (B&O, JBL / HK, …). */
  audioLabel: string;
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
    audioLabel: "B&O",
    shortlistTitle: "Extended Range met B&O — nu het scherpst geprijsd",
    shortlistNote:
      "Gebruikte Extended Range (geen GT) met Bang & Olufsen in de advertentie of als Premium, gesorteerd op prijs t.o.v. het prijsmodel. " +
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
      { title: "Uitrusting", text: "B&O, trekhaak en panoramadak komen in de tracker uit de advertentie; een Premium telt als B&O (niet per bouwjaar gecontroleerd). “Niet vermeld” betekent niet per se afwezig — vraag het na." },
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
  niro: {
    intro:
      "e-Niro of Niro EV, welk bouwjaar, en waar je op let bij een occasion. Uitrusting en jaartallen komen uit de " +
      "Kia NL-prijslijsten 2019–2026. Prijzen, kilometerstanden en accugezondheid hieronder komen live uit de tracker (Marktplaats + Gaspedaal).",
    compareVariants: ["e-Niro 39", "e-Niro 64", "Niro EV"],
    compareTitle: "e-Niro 39, e-Niro 64 of Niro EV?",
    // Same build years (2020–2022), so the gap is like for like.
    premiumPair: ["e-Niro 39", "e-Niro 64"],
    audioLabel: "JBL / Harman Kardon",
    shortlistVariants: ["e-Niro 64", "Niro EV"],
    shortlistTitle: "64 kWh met JBL of Harman Kardon — nu het scherpst geprijsd",
    shortlistNote:
      "Gebruikte e-Niro 64 en Niro EV met premium audio, gesorteerd op prijs t.o.v. het prijsmodel. Een ExecutiveLine (en bij de " +
      "Niro EV een Plus Advanced) telt altijd mee: daar zit JBL of Harman Kardon standaard op. Trekhaak, dak en SoH staan erbij voor " +
      "zover de advertentie ze noemt.",
    years: [
      {
        label: "2019 · MY19",
        changes: [
          "Start in Nederland, alleen 64 kWh (204 pk): DynamicLine en ExecutiveLine.",
          "Laden alleen 1-fase 7,2 kW (AC). Warmtepomp standaard.",
          "Trekgewicht 0 kg; Kia verkocht alleen een fietsendragerhaak.",
        ],
        verdict: "warn",
        verdictText: "Goedkoopst, maar 1-fase laden en de 7-jaarsgarantie loopt nu af.",
      },
      {
        label: "2020 · MY20",
        changes: [
          "10,25\"-navigatie met UVO Connect (was 7/8\").",
          "3-fase 11 kW laden als meerprijsoptie (€695). Warmtepomp nog standaard.",
          "Auto's gebouwd vanaf 19 mei 2020 vallen onder de BMS-recall van augustus 2026.",
        ],
        verdict: "neutral",
        verdictText: "Zoek een 3-fase-exemplaar en check de recall.",
      },
      {
        label: "2021 · MY21 (vanaf nov 2020)",
        changes: [
          "Nieuwe lijnen ComfortLine, DynamicLine, DynamicPlusLine, ExecutiveLine; 39 kWh (136 pk) erbij als instapper.",
          "3-fase 11 kW standaard vanaf DynamicLine. Schuif/kanteldak op DynamicPlusLine en ExecutiveLine.",
          "Trekgewicht 300 kg met 100 kg kogeldruk: fietsendrager of trekhaakkoffer kan.",
          "Warmtepomp wordt een optie (€995, alleen 64 kWh). Juli 2021: Edition (DynamicLine + privacy glass + stoel/stuurverwarming).",
        ],
        verdict: "good",
        verdictText: "Beste e-Niro: 3-fase laden en een bruikbare trekhaak. Vraag naar de warmtepomp.",
      },
      {
        label: "2022",
        changes: [
          "De e-Niro loopt uit (laatste prijslijst april 2022).",
          "Juli 2022: tweede generatie Niro EV. 64,8 kWh, 475 l kofferbak + 20 l frunk, 750 kg trekgewicht, 11 kW 3-fase standaard.",
          "Harman Kardon alleen op de ExecutiveLine. Snelladen niet sneller dan de e-Niro.",
        ],
        verdict: "neutral",
        verdictText: "Overgangsjaar: check welke generatie het is (de tracker leest het uit de titel).",
      },
      {
        label: "2023–2024",
        changes: [
          "ComfortLine vervalt; Edition erbij (2023).",
          "2024: actiemodellen Light Edition en Edition Advanced, zonder schuifdak, head-up display en Harman Kardon.",
        ],
        verdict: "neutral",
        verdictText: "Ruimer en zuiniger dan de e-Niro; premium audio is zeldzaam.",
      },
      {
        label: "2025",
        changes: [
          "Nieuwe namen: Light, Light Advanced, Air, Plus, Plus Advanced. Harman Kardon alleen op Plus Advanced.",
          "Geen facelift voor de EV; de vernieuwde Niro (2026) is in Nederland alleen hybride.",
        ],
        verdict: "neutral",
        verdictText: "Weinig occasions; prijs ligt dicht bij nieuw.",
      },
    ],
    trims: [
      { name: "ComfortLine", years: "2021–2022", text: "Instapper: 8\"-scherm, camera, adaptieve cruise control. 3-fase laden was een optie." },
      { name: "DynamicLine", years: "2019–2024", text: "10,25\"-navigatie; vanaf MY21 3-fase laden standaard." },
      { name: "DynamicPlusLine", years: "2021–2024", text: "Plus schuif/kanteldak, LED-koplampen, stoel- en stuurverwarming, privacy glass." },
      { name: "ExecutiveLine", years: "2019–2024", text: "Topversie: JBL (e-Niro) of Harman Kardon (Niro EV), leder, geventileerde stoelen met geheugen, dodehoekbewaking. e-Niro: alleen 64 kWh." },
      { name: "Edition / Edition Advanced", years: "2021–2024", text: "Actiemodellen op DynamicLine-basis met extra's; Edition Advanced zonder schuifdak en premium audio." },
      { name: "Light … Plus Advanced", years: "2025+", text: "Light ≈ ComfortLine, Light Advanced ≈ DynamicLine, Air ≈ Edition Advanced, Plus ≈ DynamicPlusLine, Plus Advanced ≈ ExecutiveLine." },
    ],
    trimsNote:
      "Uit de Kia NL-prijslijsten 2019–2026. De inhoud kon per modeljaar verschuiven — controleer de uitrusting per auto.",
    checks: [
      { title: "Recall BMS (aug 2026)", text: "e-Niro gebouwd 19 mei 2020 – 18 maart 2022: software-update van het batterijmanagement plus accu-inspectie; een beschadigd pakket wordt gratis vervangen. Check het kenteken in het RDW-terugroepregister. De Niro EV (2022+) valt er niet onder." },
      { title: "Garantie", text: "7 jaar / 150.000 km, accu inbegrepen (minimaal 70% capaciteit), overdraagbaar bij onderhoud volgens schema. Sinds 2025 verlengt de Kia Tot 10 Jaar Garantie dat tot 10 jaar bij onderhoud bij een Kia-dealer. Vraag de onderhoudshistorie op, zeker bij een 2019-exemplaar." },
      { title: "Laden", text: "MY19 laadt alleen 1-fase 7,2 kW; bij MY20 was 3-fase een optie. Zoek “3-fase” in de advertentie. Snelladen is traag bij alle versies: 10–80% in ~41–47 minuten." },
      { title: "Trekhaak", text: "e-Niro tot MY20: 0 kg (alleen een fietsendragerhaak). Vanaf MY21: 300 kg, 100 kg kogeldruk. Niro EV: 750 kg. Check “maximum trekken massa” op het kenteken bij de RDW." },
      { title: "Warmtepomp", text: "MY19–20 standaard op DynamicLine en ExecutiveLine, MY21+ een optie. Voor de Niro EV staat hij niet in de NL-prijslijsten: vraag het na, “warmtepomp” in een dealeradvertentie is niet altijd juist." },
      { title: "Accurapport", text: "De e-Niro 64 scoort goed (Carla/Aviloo: gemiddeld 97% SoH na >100.000 km), maar tussen auto's van hetzelfde model zit tot 13,5 procentpunt verschil. Vraag een recent SoH-rapport." },
      { title: "Proefrit", text: "Luister naar gejank uit de reductiekast; eigenaren melden het af en toe (in de VS een campagne voor te weinig olie bij Niro EV's uit 2023–24)." },
    ],
    sources: [
      { label: "Kia NL – prijslijstenarchief", url: "https://www.kia.com/nl/over-kia/prijslijsten-archief/" },
      { label: "Kia NL prijslijst e-Niro jan 2021 (PDF)", url: "https://www.kia.com/content/dam/kwcms/kme/nl/nl/assets/contents/utility/price-list/eerdere-bouwjaren/2021/kia-netherlands-e-niro-archief-prijslijst-januari21.pdf" },
      { label: "Kia NL prijslijst Niro EV jan 2026 (PDF)", url: "https://www.kia.com/content/dam/kwcms/kme/nl/nl/assets/contents/utility/price-list/Kia-Netherlands-Niro-EV-prijslijst.pdf" },
      { label: "EV Database – e-Niro 64 kWh", url: "https://ev-database.org/car/1338/Kia-e-Niro-64-kWh" },
      { label: "EV Database – Niro EV", url: "https://ev-database.org/car/1666/Kia-Niro-EV" },
      { label: "AutoReview – recall e-Niro brandgevaar", url: "https://www.autoreview.nl/nieuws/id/38127/kia-niro-terugroepactie-brandgevaar-opladen" },
      { label: "electrive – Carla/Aviloo: e-Niro beste SoH", url: "https://electrive.com/2026/07/21/study-kia-e-niro-leads-battery-health-ranking-after-high-mileage" },
      { label: "Kia NL – voorwaarden Tot 10 Jaar Garantie (PDF)", url: "https://www.kia.com/content/dam/kwcms/kme/nl/nl/assets/contents/service/garantie-en-zekerheden/tot-10-jaar-garantie/voorwaarden-en-omschrijving-kia-tot-10-jaar-garantie.pdf" },
      { label: "NHTSA – campagne reductiekastolie EV6 / Niro EV (VS)", url: "https://static.nhtsa.gov/odi/tsbs/2025/MC-11021988-0001.pdf" },
    ],
  },
};

/** Brands with a buying guide get the "Koopgids" tab. */
export function hasBuyingGuide(brand: BrandKey): boolean {
  return BUYING_GUIDE[brand] != null;
}
