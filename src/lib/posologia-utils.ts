/**
 * Utility condivise per il form posologia medico.
 * Usate da: mini-form/[token], medico/posologie/[id], medico/richieste-prescrizione/[id]
 */

export const DEFAULT_ORARI: Record<number, string[]> = {
  1: ["08:00"],
  2: ["08:00", "20:00"],
  3: ["08:00", "14:00", "20:00"],
  4: ["08:00", "12:00", "18:00", "22:00"],
};

export const UNITA_OPTIONS = [
  { value: "compressa", label: "Compresse / Capsule" },
  { value: "puff", label: "Puff / Erogazioni" },
  { value: "goccia", label: "Gocce" },
  { value: "ml", label: "ml (sciroppo / soluzione)" },
  { value: "spray", label: "Spray" },
  { value: "busta", label: "Bustine" },
  { value: "fiala", label: "Fiale / Iniezioni" },
  { value: "supposta", label: "Supposte" },
  { value: "aerosol", label: "Aerosol / Nebulizzatore" },
  { value: "unità", label: "Unità (altro)" },
] as const;

export type UnitaPosologia = (typeof UNITA_OPTIONS)[number]["value"] | "";

/** Inferisce l'unità di somministrazione dai metadati del farmaco. Ritorna "" se non rilevabile. */
export function inferUnita(farmaco: {
  unitaSomministrazione?: string | null;
  unitaMisura?: string | null;
  formaFarmaceutica?: string | null;
} | null | undefined): string {
  const source = [
    farmaco?.unitaSomministrazione,
    farmaco?.unitaMisura,
    farmaco?.formaFarmaceutica,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (/compress|pastigli|confett|dragee/.test(source)) return "compressa";
  if (/capsul/.test(source)) return "capsula";
  if (/bust/.test(source)) return "busta";
  if (/fial|ampoll|siring|iniezion|puntur/.test(source)) return "fiala";
  if (/gocc/.test(source)) return "goccia";
  if (/aerosol|nebulizzat/.test(source)) return "aerosol";
  if (/puff|erog/.test(source)) return "puff";
  if (/spray/.test(source)) return "spray";
  if (/ml|sciropp|sospens|soluz/.test(source)) return "ml";
  if (/suppost|rettale/.test(source)) return "supposta";
  return "";
}

/** Label del campo quantità in base all'unità. */
export function getDoseLabel(unita: string): string {
  switch (unita) {
    case "compressa":
    case "capsula": return "Quante compresse / capsule per assunzione?";
    case "busta": return "Quante bustine per assunzione?";
    case "fiala": return "Quante fiale / iniezioni per assunzione?";
    case "supposta": return "Quante supposte per assunzione?";
    case "aerosol": return "Quante inalazioni / sessioni per assunzione?";
    case "goccia": return "Quante gocce per assunzione?";
    case "puff": return "Quanti puff per assunzione?";
    case "spray": return "Quante erogazioni spray per assunzione?";
    case "ml": return "Quanti ml per assunzione?";
    default: return "Quantità per assunzione";
  }
}

/** Step dell'input numerico in base all'unità. */
export function getDoseStep(unita: string): number {
  if (unita === "ml") return 0.25;
  if (["goccia", "puff", "spray", "fiala", "supposta", "aerosol"].includes(unita)) return 1;
  return 0.5;
}

/** Placeholder dell'input quantità in base all'unità. */
export function getDosePlaceholder(unita: string): string {
  switch (unita) {
    case "goccia": return "es. 10";
    case "fiala": return "es. 1";
    case "supposta": return "es. 1";
    case "aerosol": return "es. 1";
    case "ml": return "es. 2.5";
    case "puff":
    case "spray": return "es. 2";
    default: return "es. 1 o 1/2";
  }
}

// ─── Scorciatoie dose (frazioni comuni) ─────────────────────────────────────

export const DOSE_FRACTIONS = [
  { label: "¼", value: "0.25" },
  { label: "½", value: "0.5" },
  { label: "1", value: "1" },
  { label: "1½", value: "1.5" },
  { label: "2", value: "2" },
  { label: "3", value: "3" },
] as const;

/**
 * Parsa una stringa di frazione (es. "1/2", "1/4", "2", "0.5") in un numero.
 * Restituisce NaN se il valore non è valido.
 */
export function parseFrazione(s: string | number): number {
  if (typeof s === "number") return s;
  const t = s.trim().replace(",", ".");
  if (t.includes("/")) {
    const parts = t.split("/").map((p) => parseFloat(p.trim()));
    if (parts.length !== 2 || parts.some(isNaN) || parts[1] === 0) return NaN;
    return parts[0] / parts[1];
  }
  return parseFloat(t);
}

// ─── Preset frequenze periodiche ─────────────────────────────────────────────

export const PRESET_INTERVALLI = [
  { label: "1/sett.", giorni: 7, testo: "1 volta a settimana" },
  { label: "1/2 sett.", giorni: 14, testo: "1 ogni 2 settimane" },
  { label: "1/mese", giorni: 30, testo: "1 volta al mese" },
  { label: "1/2 mesi", giorni: 60, testo: "1 ogni 2 mesi" },
] as const;

// ─── Momento di assunzione ───────────────────────────────────────────────────

export const MOMENTI_ASSUNZIONE_OPTIONS = [
  { value: "stomaco_vuoto",  label: "Stomaco vuoto",    emoji: "🌅", subtext: "Appena svegli" },
  { value: "colazione",      label: "A colazione",      emoji: "🍳", subtext: "Con cibo" },
  { value: "prima_pranzo",   label: "Prima di pranzo",  emoji: "☀️",  subtext: "30 min prima" },
  { value: "dopo_pranzo",    label: "Dopo pranzo",      emoji: "🍽️",  subtext: "Con il pasto" },
  { value: "prima_cena",     label: "Prima di cena",    emoji: "🌆", subtext: "30 min prima" },
  { value: "dopo_cena",      label: "Dopo cena",        emoji: "🌃", subtext: "Con il pasto" },
  { value: "prima_dormire",  label: "Prima di dormire", emoji: "🌙", subtext: "A letto" },
  { value: "indipendente",   label: "Indipendente",     emoji: "💊", subtext: "Senza vincoli" },
] as const;

export type MomentoAssunzione = (typeof MOMENTI_ASSUNZIONE_OPTIONS)[number]["value"];

/** Restituisce true se il momento implica l'assunzione con il cibo. */
export function momentoImplicaConPasto(momento: string): boolean {
  return ["colazione", "dopo_pranzo", "dopo_cena"].includes(momento);
}

/**
 * Restituisce l'orario suggerito in base al momento di assunzione.
 * Usato per pre-popolare il campo orario quando il medico seleziona il momento.
 */
export function orarioDaMomento(momento: string): string {
  const MAP: Record<string, string> = {
    stomaco_vuoto: "07:00",
    colazione: "08:00",
    prima_pranzo: "12:30",
    dopo_pranzo: "13:30",
    prima_cena: "19:30",
    dopo_cena: "20:30",
    prima_dormire: "22:00",
    indipendente: "08:00",
  };
  return MAP[momento] ?? "08:00";
}
