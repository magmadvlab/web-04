/**
 * Badge di stato condivisi per tutte le pagine richieste/appuntamenti.
 * Usati da: medico, specialista, professionista, paziente (consulti, rinnovi, visite)
 */

export type StatoBadge = {
  bg: string;
  text: string;
  label: string;
  icon: string;
};

/** Mappa unificata di tutti gli stati possibili */
export const STATI_BADGE: Record<string, StatoBadge> = {
  in_attesa:      { bg: "bg-yellow-100",  text: "text-yellow-800",  label: "In Attesa",       icon: "⏳" },
  pendente:       { bg: "bg-yellow-100",  text: "text-yellow-800",  label: "In Attesa",       icon: "⏳" },
  accettata:      { bg: "bg-green-100",   text: "text-green-800",   label: "Confermata",      icon: "✓"  },
  confermata:     { bg: "bg-green-100",   text: "text-green-800",   label: "Confermata",      icon: "✓"  },
  approvata:      { bg: "bg-green-100",   text: "text-green-800",   label: "Approvata",       icon: "✓"  },
  riprogrammata:  { bg: "bg-indigo-100",  text: "text-indigo-800",  label: "Riprogrammata",   icon: "↻"  },
  rifiutata:      { bg: "bg-red-100",     text: "text-red-800",     label: "Rifiutata",       icon: "✗"  },
  annullata:      { bg: "bg-gray-100",    text: "text-gray-800",    label: "Annullata",       icon: "✗"  },
  cancellata:     { bg: "bg-gray-100",    text: "text-gray-800",    label: "Cancellata",      icon: "✗"  },
  completata:     { bg: "bg-blue-100",    text: "text-blue-800",    label: "Completata",      icon: "✓"  },
  non_presentato: { bg: "bg-orange-100",  text: "text-orange-800",  label: "Non Presentato",  icon: "⚠"  },
  attesa_posologia: { bg: "bg-purple-100", text: "text-purple-800", label: "Attesa Posologia", icon: "📋" },
  attesa_ricetta_gestionale: { bg: "bg-blue-100", text: "text-blue-800", label: "In Gestionale", icon: "📄" },
};

/** Fallback per stati non riconosciuti */
export const BADGE_FALLBACK: StatoBadge = {
  bg: "bg-gray-100", text: "text-gray-700", label: "Sconosciuto", icon: "?"
};

/**
 * Restituisce il badge per uno stato, con fallback.
 * Gestisce alias (pendente → in_attesa, cancellata → annullata, ecc.)
 */
export function getStatoBadge(stato?: string | null): StatoBadge {
  if (!stato) return STATI_BADGE.in_attesa;
  return STATI_BADGE[stato.toLowerCase()] ?? BADGE_FALLBACK;
}

/**
 * Normalizza varianti di stato al valore canonico.
 * Es: "pendente" → "in_attesa", "cancellata" → "annullata"
 */
export function normalizeStato(stato?: string | null): string {
  const s = String(stato || "").toLowerCase();
  if (s === "pendente") return "in_attesa";
  if (s === "confermata") return "accettata";
  if (s === "cancellata") return "annullata";
  return s || "in_attesa";
}
