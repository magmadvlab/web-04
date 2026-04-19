import api from "@/lib/api";

export interface MedicoMiniFormPending {
  id: number;
  token: string;
  stato: string;
  expiresAt: string;
  createdAt: string;
  paziente?: {
    id: number;
    nome: string;
    cognome: string;
    codiceFiscale?: string | null;
  } | null;
  prescrizione?: {
    id: number;
    codiceNre?: string | null;
    dataEmissione?: string | null;
  } | null;
  farmaco?: {
    id?: number | null;
    nomeCommerciale?: string | null;
    principioAttivo?: string | null;
    dosaggio?: string | null;
    formaFarmaceutica?: string | null;
    unitaMisura?: string | null;
    unitaSomministrazione?: string | null;
  } | null;
}

export const getMedicoMiniFormsPending = async (): Promise<MedicoMiniFormPending[]> => {
  const response = await api.get<any>("/mini-form/per-medico");
  const payload = response.data;

  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.data)) {
    return payload.data;
  }

  return [];
};

export const getMiniFormLabel = (form: MedicoMiniFormPending): string =>
  form.farmaco?.nomeCommerciale ??
  form.farmaco?.principioAttivo ??
  "Farmaco da specificare";
