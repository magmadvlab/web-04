import type { TimelineEvent, TimelineDay } from "@/types/timeline";

const TYPE_PRIORITY: Record<string, number> = {
  urgency: 0,
  logistics: 1,
  dose: 2,
  notification: 3,
};

/** Sort events: by timestamp ASC, then by type priority for ties */
function sortEvents(events: TimelineEvent[]): TimelineEvent[] {
  return [...events].sort((a, b) => {
    const dt = a.timestamp.getTime() - b.timestamp.getTime();
    if (dt !== 0) return dt;
    return (TYPE_PRIORITY[a.type] ?? 99) - (TYPE_PRIORITY[b.type] ?? 99);
  });
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function dayLabel(date: Date): string {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  if (isSameDay(date, today)) {
    return `OGGI — ${date.toLocaleDateString("it-IT", { day: "numeric", month: "long" })}`;
  }
  if (isSameDay(date, tomorrow)) {
    return `DOMANI — ${date.toLocaleDateString("it-IT", { day: "numeric", month: "long" })}`;
  }
  return date
    .toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" })
    .toUpperCase();
}

/** Group sorted events into days */
export function groupByDay(events: TimelineEvent[]): TimelineDay[] {
  const sorted = sortEvents(events);
  const map = new Map<string, TimelineDay>();

  for (const event of sorted) {
    const key = event.timestamp.toDateString();
    if (!map.has(key)) {
      map.set(key, { label: dayLabel(event.timestamp), events: [] });
    }
    map.get(key)!.events.push(event);
  }

  return Array.from(map.values());
}

/** Build TimelineEvent[] from raw API data */
export function buildEventsFromTerapie(terapie: any[]): TimelineEvent[] {
  const today = new Date();
  const events: TimelineEvent[] = [];

  for (const t of terapie) {
    const nomeFarmaco: string =
      t?.farmaco?.nomeCommerciale ??
      t?.farmaci?.[0]?.farmaco?.nomeCommerciale ??
      t?.nomeFarmaco ??
      "Farmaco";

    // Urgency event if prescription expiry < 7 days
    const scadenza = t?.dataScadenzaPrescrizione
      ? new Date(t.dataScadenzaPrescrizione)
      : null;
    if (scadenza) {
      const diffDays = Math.ceil(
        (scadenza.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
      );
      if (diffDays > 0 && diffDays < 7) {
        events.push({
          id: `urgency-${t.id}`,
          timestamp: today,
          type: "urgency",
          color: "red",
          tag: `⚠ Urgente — Scadenza prescrizione`,
          title: `Rinnova ${nomeFarmaco}`,
          subtitle: `Scade tra ${diffDays} ${diffDays === 1 ? "giorno" : "giorni"}`,
          actionLabel: "Richiedi rinnovo",
          actionUrl: "/paziente/prescrizioni",
        });
      }
    }

    // Dose events from posologia.orari[]
    const orari: string[] =
      t?.posologia?.orari ?? t?.orariAssunzione ?? [];
    for (const orario of orari) {
      const [hh, mm] = (orario as string).split(":").map(Number);
      const ts = new Date(today);
      ts.setHours(hh ?? 0, mm ?? 0, 0, 0);

      // If time already passed today, keep as today (confirmed); future = gray
      const isPast = ts.getTime() < today.getTime();

      events.push({
        id: `dose-${t.id}-${orario}`,
        timestamp: ts,
        type: "dose",
        color: isPast ? "green" : "gray",
        tag: `${orario} — ${isPast ? "Dose confermata" : "Dose programmata"}`,
        title: nomeFarmaco,
        subtitle: t?.posologia?.istruzioni ?? undefined,
      });
    }
  }

  return events;
}

export function buildEventsFromOrdini(ordini: any[]): TimelineEvent[] {
  return ordini.map((o) => ({
    id: `ordine-${o.id}`,
    timestamp: o.dataConsegnaStimata
      ? new Date(o.dataConsegnaStimata)
      : new Date(),
    type: "logistics" as const,
    color: "blue" as const,
    tag: o.finestraConsegna
      ? `${o.finestraConsegna} — Consegna`
      : "Oggi — Consegna",
    title: `Ordine #${o.id} in arrivo`,
    subtitle: "Rider assegnato",
    actionLabel: "Traccia",
    actionUrl: `/paziente/ordini/${o.id}`,
  }));
}

export function buildEventsFromNotifications(notifications: any[]): TimelineEvent[] {
  return notifications.map((n) => ({
    id: `notif-${n.id}`,
    timestamp: new Date(n.createdAt),
    type: "notification" as const,
    color: "blue" as const,
    tag: "Notifica",
    title: n.title ?? "Messaggio",
    subtitle: n.body ?? undefined,
    actionUrl: n.actionUrl ?? undefined,
  }));
}
