// Cross-tracker comparison (/vergelijk): one column per tracked vehicle, the
// variant and build years a buyer would realistically compare. Static spec
// research (European versions, researched 2026-11-03) lives here; the page adds
// live stats from each tracker via `match`. Leave a value null rather than guess.

import type { BrandKey } from "./brands";
import type { Listing } from "./types";

export interface CompareVehicle {
  id: string;
  name: string;
  years: string;
  kind: "ev" | "phev" | "ice";
  /** Which tracker dataset the live stats come from … */
  dataset: BrandKey;
  /** … and which of its listings count as this vehicle. */
  match: (l: Listing) => boolean;
  bootL: number | null;
  bootMaxL: number | null;
  frunkL: number | null;
  towKg: number | null;
  audio: string | null;
  pano: string | null;
  batteryKwh: number | null;
  wltpKm: number | null;
  realSummerKm: number | null;
  realWinterKm: number | null;
  realWinterHighwayKm: number | null;
  dcKw: number | null;
  dc10to80min: number | null;
  heatPump: string | null;
  degradation: string | null;
  upgrades: string;
  note: string | null;
  sources: { label: string; url: string }[];
}

const inYears = (l: Listing, from: number, to: number) => l.year != null && l.year >= from && l.year <= to;

export const COMPARE_VEHICLES: CompareVehicle[] = [
  {
    id: "tesla-y-lr", name: "Model Y LR AWD", years: "2021–2024", kind: "ev", dataset: "tesla",
    match: (l) => l.model === "Model Y" && !l.is_juniper && l.trim === "Long Range" && inYears(l, 2021, 2024),
    bootL: 854, bootMaxL: 2041, frunkL: 117, towKg: 1600,
    audio: "Tesla premium, 13 speakers + sub (standaard)", pano: "standaard (glazen dak)",
    batteryKwh: 75, wltpKm: 542, realSummerKm: 515, realWinterKm: 375, realWinterHighwayKm: 320,
    dcKw: 250, dc10to80min: 27, heatPump: "standaard",
    degradation: "Aviloo 2026: mediaan 94,4% bij 50k, 91,9% bij 100k, 90,3% bij 150k km. Tesla: ~15% verlies na 320.000 km.",
    upgrades: "Warmtepomp en dubbel glas voor vanaf de start. Okt 2022: parkeersensoren vervallen (alleen camera's). HW4: bron noemt Berlijn pas sep 2024 — check in het scherm.",
    note: "Tesla meet tot het dak incl. onderbak (Skoda/VW/Ford tot de hoedenplank). Vroege NL-auto's (jul 2021–jan 2022): 72 kWh, 210 kW, ~490/355 km.",
    sources: [
      { label: "EV Database – Model Y LR 2022–2025", url: "https://ev-database.org/car/1619/Tesla-Model-Y-Long-Range-AWD" },
      { label: "Tesla handleiding – afmetingen", url: "https://www.tesla.cn/ownersmanual/2020_2024_modely/en_cn/GUID-E47C4A6D-528E-419C-8C57-FD3864644C34.html" },
    ],
  },
  {
    id: "mach-e-er", name: "Mach-E ER RWD", years: "2021–2022", kind: "ev", dataset: "mach-e",
    match: (l) => l.trim === "Extended Range" && l.drivetrain === "RWD" && inYears(l, 2021, 2022),
    bootL: 402, bootMaxL: 1420, frunkL: 100, towKg: 1000,
    audio: "B&O, 10 speakers (optie, Technology Pack)", pano: "optie (Technology Pack Plus)",
    batteryKwh: 88, wltpKm: 610, realSummerKm: 530, realWinterKm: 395, realWinterHighwayKm: 330,
    dcKw: 107, dc10to80min: 46, heatPump: "nee (pas vanaf 2025)",
    degradation: "Aviloo 2026: mediaan 95,1% bij 50k, 93,5% bij 100k, 92,5% bij 150k km — de beste van deze EV's.",
    upgrades: "Recall 22S41 tot bouw mei 2022. Mei 2022: trekgewicht 750 → 1.000 kg (ook bestaande auto's). 2023: BlueCruise 1.2. 2025: warmtepomp.",
    note: "Laden: EV Database meet 107 kW (Ford claimt 150 kW); pas vanaf okt 2023 echt 150 kW / 35 min. Kofferbak 402 L tot de hoedenplank, 519 L tot het dak. Trekgewicht: check of het kenteken bij de RDW is bijgewerkt.",
    sources: [
      { label: "EV Database – Mach-E ER RWD MY21", url: "https://ev-database.org/car/1243/Ford-Mustang-Mach-E-ER-RWD" },
      { label: "Ford persbericht mei 2022 – trekgewicht 1.000 kg (PDF)", url: "https://www.fordpers.be/content/documents/news/2022/2022_05_05_mustang_mach_e_updates_en.pdf" },
      { label: "Ford BE prijslijst MY2021 (pakketten, B&O, pano)", url: "https://www.fordpers.be/editor/files/2020_05_28_mustang_mach_e_prices_nl.pdf" },
    ],
  },
  {
    id: "enyaq-80", name: "Enyaq iV 80", years: "2021–2023", kind: "ev", dataset: "enyaq",
    match: (l) => l.trim === "80" && l.body !== "Coupé" && inYears(l, 2021, 2023),
    bootL: 585, bootMaxL: 1710, frunkL: 0, towKg: 1000,
    audio: "Canton, 12 speakers (optie)", pano: "optie",
    batteryKwh: 77, wltpKm: 548, realSummerKm: 505, realWinterKm: 370, realWinterHighwayKm: 315,
    dcKw: 135, dc10to80min: 27, heatPump: "optie",
    degradation: "Aviloo 2026: mediaan 95,1% bij 50k, 92,7% bij 100k, 91,0% bij 150k km.",
    upgrades: "Jan 2022: 125 → 135 kW laden. Nov 2023 (85): 286 pk, software 4.0, ~520/380 km — in de tracker even duur als een 2023.",
    note: "Gemeten 10–80% eerder ~30–37 min. 80x (AWD): 1.200–1.400 kg trekgewicht.",
    sources: [
      { label: "EV Database – Enyaq iV 80", url: "https://ev-database.org/car/1280/Skoda-Enyaq-iV-80" },
      { label: "EV Database – Enyaq 85 (MY24)", url: "https://ev-database.org/car/2020/Skoda-Enyaq-85" },
      { label: "Skoda – Enyaq 2024 persmap (PDF)", url: "https://www.skoda-storyboard.com/direct-download/2023/12/01_Press_Kit_Explore_Enyaq_2024_Introduction_a6f552e2.pdf" },
    ],
  },
  {
    id: "id4-pro", name: "ID.4 Pro 77 kWh", years: "2021–2023", kind: "ev", dataset: "id4",
    match: (l) => l.trim === "Pro" && inYears(l, 2021, 2023),
    bootL: 543, bootMaxL: 1575, frunkL: 0, towKg: 1000,
    audio: "Harman Kardon, 8+1 speakers (optie, zeldzaam)", pano: "optie",
    batteryKwh: 77, wltpKm: 537, realSummerKm: 470, realWinterKm: 350, realWinterHighwayKm: 295,
    dcKw: 135, dc10to80min: 27, heatPump: "optie",
    degradation: "Aviloo 2026: mediaan 95,2% bij 50k, 92,5% bij 100k, 90,8% bij 150k km.",
    upgrades: "2022: software 3.0, 125 → 135 kW laden. Eind 2023 (MY24): 286 pk, 12,9\"-scherm, 175 kW, ~515/375 km.",
    note: "Cijfers voor de 204 pk Pro Performance. 4MOTION: 1.200 kg trekgewicht.",
    sources: [
      { label: "EV Database – ID.4 Pro Performance 2020–2023", url: "https://ev-database.org/car/1314/Volkswagen-ID4-Pro-Performance" },
      { label: "EV Database – ID.4 Pro MY24 (286 pk)", url: "https://ev-database.org/car/2028/Volkswagen-ID4-Pro" },
    ],
  },
  {
    id: "superb-iv", name: "Superb Combi iV", years: "2020–2023", kind: "phev", dataset: "skoda",
    match: (l) => l.model === "Superb" && l.fuel === "PHEV" && inYears(l, 2020, 2023),
    bootL: 510, bootMaxL: 1800, frunkL: 0, towKg: 1600,
    audio: "Canton, 12 speakers + sub, 610 W (optie)", pano: "optie",
    batteryKwh: 13, wltpKm: 56, realSummerKm: null, realWinterKm: null, realWinterHighwayKm: null,
    dcKw: null, dc10to80min: null, heatPump: "nee",
    degradation: "Geen betrouwbare gepubliceerde data voor de 13 kWh-accu.",
    upgrades: "2024 nieuwe generatie: 25,7 kWh, ~120–134 km elektrisch, 50 kW snelladen; kofferbak PHEV blijft 510 L.",
    note: "150 L kleiner dan de benzine-Combi (660 L) door de accu. Laden alleen AC 3,6 kW. Trekgewicht 1.900 kg bij 8% helling.",
    sources: [
      { label: "Skoda technische data Superb Combi iV (PDF)", url: "https://cdn.skoda-storyboard.com/2019/11/TD-SUPERB-COMBI-iV-en.pdf" },
      { label: "ADAC Autokatalog – Superb Combi iV", url: "https://www.adac.de/rund-ums-fahrzeug/autokatalog/marken-modelle/skoda/superb/3generation-facelift/307602/" },
    ],
  },
  {
    id: "octavia-combi", name: "Octavia Combi 1.0/1.5", years: "2020–2024", kind: "ice", dataset: "skoda",
    match: (l) => l.model === "Octavia" && inYears(l, 2020, 2024) && (l.power_hp ?? 0) <= 150 && !/\biv\b|phev|plug/i.test(l.title ?? ""),
    bootL: 640, bootMaxL: 1700, frunkL: 0, towKg: 1500,
    audio: "Canton, 12 speakers (optie)", pano: "optie",
    batteryKwh: null, wltpKm: null, realSummerKm: null, realWinterKm: null, realWinterHighwayKm: null,
    dcKw: null, dc10to80min: null, heatPump: "nee",
    degradation: "N.v.t. (48V mild hybrid, geen tractie-accu).",
    upgrades: "Eerste jaren haperend infotainment. 2024 facelift: 13\"-scherm, USB-C, 1.0 TSI vervalt.",
    note: "Trekgewicht 1.500 kg geldt voor de 1.5; de 1.0 (110 pk) is zwak met een aanhanger. Tracker labelt de mild hybrids deels als PHEV.",
    sources: [
      { label: "Skoda technische data Octavia Combi 2020 (PDF)", url: "https://cdn.skoda-storyboard.com/2020/07/TD-OCTAVIA-COMBI-petrol-en.pdf" },
      { label: "ADAC Autokatalog – Octavia Combi 1.5 e-TEC", url: "https://www.adac.de/rund-ums-fahrzeug/autokatalog/marken-modelle/skoda/octavia/4generation/318374/" },
    ],
  },
];

/** DC charging per build/order period, per model. Periods are EV Database's
 *  order windows for the Netherlands where it gives them; a car's registration
 *  date can lag a few months, so check the build month for cars near a boundary. */
export interface ChargeStep {
  period: string;
  batteryKwh: number | null;
  dcKw: number | null;
  min10to80: number | null;
  note?: string;
  source?: { label: string; url: string };
}

export const CHARGING_HISTORY: { model: string; phev?: boolean; steps: ChargeStep[] }[] = [
  {
    model: "Model Y LR AWD",
    steps: [
      { period: "jul 2021 – jan 2022", batteryKwh: 72, dcKw: 210, min10to80: 29, note: "LG-accu",
        source: { label: "EV Database", url: "https://ev-database.org/car/1182/Tesla-Model-Y-Long-Range-AWD" } },
      { period: "2022 – 2024", batteryKwh: 75, dcKw: 250, min10to80: 27,
        source: { label: "EV Database", url: "https://ev-database.org/car/1619/Tesla-Model-Y-Long-Range-AWD" } },
    ],
  },
  {
    model: "Mach-E ER RWD",
    steps: [
      { period: "apr 2021 – apr 2022 (MY21)", batteryKwh: 88, dcKw: 107, min10to80: 46, note: "Ford claimt 150 kW; mei 2022-update: 80–90% van 52 naar 15 min",
        source: { label: "EV Database", url: "https://ev-database.org/car/1243/Ford-Mustang-Mach-E-ER-RWD" } },
      { period: "apr 2022 – okt 2023 (MY22–23)", batteryKwh: 91, dcKw: 107, min10to80: 48,
        source: { label: "EV Database", url: "https://ev-database.org/car/1754/Ford-Mustang-Mach-E-ER-RWD" } },
      { period: "okt 2023 – jun 2025 (MY23.75–24)", batteryKwh: 91, dcKw: 150, min10to80: 35, note: "flinke stap",
        source: { label: "EV Database", url: "https://ev-database.org/car/2035/Ford-Mustang-Mach-E-ER-RWD" } },
      { period: "apr 2025+ (MY25)", batteryKwh: 88, dcKw: 150, min10to80: 37, note: "warmtepomp",
        source: { label: "EV Database", url: "https://ev-database.org/imp/car/3188/Ford-Mustang-Mach-E-ER-RWD" } },
    ],
  },
  {
    model: "Enyaq 80 / 85",
    steps: [
      { period: "2021 – bouw jan 2022 (80)", batteryKwh: 77, dcKw: 125, min10to80: null, note: "Skoda: 5–80% in 38 min; soms betaald op te waarderen",
        source: { label: "Fleet News", url: "https://www.fleetnews.co.uk/news/manufacturer-news/2022/02/11/skoda-enyaq-updates-include-faster-charging" } },
      { period: "bouw jan 2022 – 2023 (80)", batteryKwh: 77, dcKw: 135, min10to80: 27, note: "gemeten eerder 30–37 min",
        source: { label: "EV Database", url: "https://ev-database.org/car/1280/Skoda-Enyaq-iV-80" } },
      { period: "bouw nov 2023+ (85)", batteryKwh: 77, dcKw: 135, min10to80: 28, note: "85x en RS: 175 kW",
        source: { label: "EV Database", url: "https://ev-database.org/car/2020/Skoda-Enyaq-85" } },
    ],
  },
  {
    model: "ID.4 Pro 77 kWh",
    steps: [
      { period: "2021 (204 pk)", batteryKwh: 77, dcKw: 125, min10to80: null, note: "125 kW tot software 3.0",
        source: { label: "electrive", url: "https://www.electrive.com/2021/12/16/vw-introduces-charging-update-off-the-production-line" } },
      { period: "2022 – 2023 (204 pk)", batteryKwh: 77, dcKw: 135, min10to80: 27,
        source: { label: "EV Database", url: "https://ev-database.org/car/1314/Volkswagen-ID4-Pro-Performance" } },
      { period: "MY2024+ (286 pk)", batteryKwh: 77, dcKw: 175, min10to80: 28,
        source: { label: "EV Database", url: "https://ev-database.org/car/2028/Volkswagen-ID4-Pro" } },
    ],
  },
  {
    model: "Superb Combi iV",
    phev: true,
    steps: [
      { period: "2020 – 2023 (B8)", batteryKwh: 13, dcKw: null, min10to80: null, note: "geen snelladen; AC 3,6 kW",
        source: { label: "Skoda technische data", url: "https://cdn.skoda-storyboard.com/2019/11/TD-SUPERB-COMBI-iV-en.pdf" } },
      { period: "2024+ (B9)", batteryKwh: 25.7, dcKw: 50, min10to80: 25,
        source: { label: "Autozine", url: "https://www.autozine.nl/skoda/superb-combi/nieuws/skoda-superb-combi-nu-ook-als-phev" } },
    ],
  },
];

/** Listings that look cheap for a reason only stated in the ad text (which the
 *  web dataset doesn't carry), so the title-based trap filter misses them. */
export const KNOWN_TRAP_IDS = new Set<string>([
  "m2458110004", // Model Y LR 2022 €23.999 — US import
  "m2457923764", // Model Y Dual Motor 2023 €26.000 — export/trade only
]);

/** Battery-health studies used across the EV columns. */
export const COMPARE_SHARED_SOURCES = [
  { label: "Carscoops – Aviloo-studie 2026 (SoH bij 50/100/150k km)", url: "https://www.carscoops.com/2026/09/battery-ev-degradation-study/" },
  { label: "Electrek – Aviloo, grootste accustudie", url: "https://electrek.co/2026/09/03/evs-retain-battery-best-aviloo-largest-study/" },
  { label: "InsideEVs – Tesla Impact Report, degradatie Model 3/Y", url: "https://insideevs.com/news/723734/tesla-model-3y-battery-capacity-degradation-200000miles/" },
];

export const COMPARE_DATASETS: BrandKey[] = [...new Set(COMPARE_VEHICLES.map((v) => v.dataset))];
