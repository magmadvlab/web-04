export interface ReferentePrescrittivoLike {
  medicoId?: number | null;
  medicoCuranteId?: number | null;
  medicoCurante?: {
    id?: number | null;
    nome?: string | null;
    cognome?: string | null;
  } | null;
  medicoDestinatarioId?: number | null;
  medicoDestinatario?: {
    id?: number | null;
    nome?: string | null;
    cognome?: string | null;
  } | null;
  specialistaDestinatarioId?: number | null;
  specialistaDestinatario?: {
    id?: number | null;
    nome?: string | null;
    cognome?: string | null;
  } | null;
}

export function resolveReferentePrescrittivoId(
  profile: ReferentePrescrittivoLike | null | undefined,
): number | null {
  if (!profile) return null;

  return (
    profile.medicoDestinatarioId ??
    profile.medicoDestinatario?.id ??
    profile.specialistaDestinatarioId ??
    profile.specialistaDestinatario?.id ??
    profile.medicoId ??
    profile.medicoCuranteId ??
    profile.medicoCurante?.id ??
    null
  );
}

export function getReferentePrescrittivoDisplayName(
  profile: ReferentePrescrittivoLike | null | undefined,
): string | null {
  if (!profile) return null;

  const referente =
    profile.medicoDestinatario ??
    profile.specialistaDestinatario ??
    profile.medicoCurante ??
    null;
  if (!referente?.nome && !referente?.cognome) return null;

  return [referente.nome, referente.cognome].filter(Boolean).join(" ").trim();
}
