export type OrderClassification = "otc" | "prescrizione" | "misto";

type GenericOrderItem = {
  ricettaRichiesta?: boolean | null;
};

type OrderLike = {
  prescrizioneId?: number | string | null;
  tipoOrdine?: OrderClassification | "prescription" | "mixed";
  items?: unknown[] | null;
  farmaci?: unknown[] | null;
  farmaciDaBanco?: unknown[] | null;
  prescrizione?: {
    id?: number | string | null;
  } | null;
};

const toArray = <T>(value: T[] | null | undefined): T[] => (Array.isArray(value) ? value : []);

const hasEntityId = (value: unknown): boolean => {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0;
  }

  if (typeof value === "string") {
    return value.trim().length > 0;
  }

  return false;
};

const hasRicettaFlag = (items: unknown[], expected: boolean): boolean =>
  items.some((item) => {
    if (!item || typeof item !== "object" || !("ricettaRichiesta" in item)) {
      return false;
    }

    return (item as GenericOrderItem).ricettaRichiesta === expected;
  });

export function classifyOrder(order: OrderLike): OrderClassification {
  if (order.tipoOrdine === "misto" || order.tipoOrdine === "mixed") {
    return "misto";
  }

  if (order.tipoOrdine === "prescrizione" || order.tipoOrdine === "prescription") {
    return "prescrizione";
  }

  if (order.tipoOrdine === "otc") {
    return "otc";
  }

  const farmaci = toArray(order.farmaci);
  const farmaciDaBanco = toArray(order.farmaciDaBanco);
  const items = toArray(order.items);

  const hasPrescriptionReference =
    hasEntityId(order.prescrizioneId) || hasEntityId(order.prescrizione?.id);

  const hasPrescriptionFlags =
    hasRicettaFlag(farmaci, true) ||
    hasRicettaFlag(items, true);

  const hasOtcFlags =
    hasRicettaFlag(farmaciDaBanco, false) ||
    hasRicettaFlag(items, false);

  const hasPrescriptionItems =
    hasPrescriptionReference || farmaci.length > 0 || hasPrescriptionFlags;

  const hasOtcItems =
    farmaciDaBanco.length > 0 || hasOtcFlags || (!hasPrescriptionItems && items.length > 0);

  if (hasPrescriptionItems && hasOtcItems) {
    return "misto";
  }

  if (hasPrescriptionItems) {
    return "prescrizione";
  }

  return "otc";
}

export function getOrderTypeLabel(type: OrderClassification): string {
  switch (type) {
    case "misto":
      return "Misto";
    case "prescrizione":
      return "Prescrizione";
    default:
      return "OTC";
  }
}
