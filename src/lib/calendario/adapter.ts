import {
  format,
  eachDayOfInterval,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  isBefore,
  startOfDay,
} from 'date-fns';
import type {
  Disponibilita,
  Eccezione,
  Prenotazione,
  DayAvailability,
  TimeSlot,
  DayStatus,
  ClinicSettings,
} from './types';

export class CalendarioAdapter {
  private static getDurataSlot(disp: any): number {
    const raw = Number(disp?.durataSlot ?? disp?.slotDurata ?? 30);
    return Number.isFinite(raw) && raw > 0 ? raw : 30;
  }

  private static getCapienzaSlot(disp: any): number {
    const raw = Number(
      disp?.postiPerSlot ??
        disp?.maxPrenotazioniPerSlot ??
        disp?.maxOrdiniPerSlot ??
        1
    );
    return Number.isFinite(raw) && raw > 0 ? raw : 1;
  }

  private static normalizeDateKey(value: unknown): string | null {
    if (!value) return null;
    if (typeof value === 'string') {
      const iso = value.slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
    }
    const parsed = new Date(value as any);
    if (Number.isNaN(parsed.getTime())) return null;
    return format(parsed, 'yyyy-MM-dd');
  }

  private static isDateInRange(
    dateKey: string,
    start?: unknown,
    end?: unknown
  ): boolean {
    const startKey = this.normalizeDateKey(start);
    const endKey = this.normalizeDateKey(end) ?? startKey;
    if (!startKey) return true;
    if (!endKey) return dateKey >= startKey;
    return dateKey >= startKey && dateKey <= endKey;
  }

  /**
   * Converte disponibilità + eccezioni + prenotazioni in formato MedCal
   */
  static generateMonthAvailability(
    disponibilita: Disponibilita[],
    eccezioni: Eccezione[],
    prenotazioni: Prenotazione[],
    anno: number,
    mese: number
  ): Record<string, DayAvailability> {
    const result: Record<string, DayAvailability> = {};
    
    // Genera tutti i giorni del mese (inclusi giorni settimana precedente/successiva per griglia)
    const monthStart = startOfMonth(new Date(anno, mese, 1));
    const monthEnd = endOfMonth(new Date(anno, mese, 1));
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 }); // Lunedì
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    
    const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
    
    days.forEach(day => {
      const dateKey = format(day, 'yyyy-MM-dd');
      const dayOfWeek = day.getDay();
      const isPast = isBefore(day, startOfDay(new Date()));
      
      // Cerca eccezione per questo giorno
      const eccezione = eccezioni.find((e: any) =>
        this.isDateInRange(
          dateKey,
          e.dataInizio ?? e.data,
          e.dataFine ?? e.dataInizio ?? e.data
        )
      );
      
      // Se è chiusura esplicita
      if (eccezione && (eccezione.tipo === 'chiusura' || eccezione.tipo === 'ferie' || eccezione.tipo === 'congedo')) {
        result[dateKey] = {
          date: dateKey,
          status: 'closed',
          slots: [],
          slotsAvailableCount: 0
        };
        return;
      }
      
      const dispGiorno = disponibilita.filter((d: any) =>
        d.giornoSettimana === dayOfWeek &&
        d.attivo &&
        this.isDateInRange(
          dateKey,
          d.dataInizio,
          d.dataFine
        )
      );

      const isOrarioSpeciale =
        eccezione &&
        (eccezione.tipo === 'orario_speciale' ||
          eccezione.tipo === 'apertura_straordinaria' ||
          eccezione.tipo === 'orario_ridotto') &&
        !!eccezione.oraInizio &&
        !!eccezione.oraFine;

      if (!isOrarioSpeciale && dispGiorno.length === 0) {
        // Nessuna disponibilità configurata per questo giorno
        result[dateKey] = {
          date: dateKey,
          status: 'closed',
          slots: [],
          slotsAvailableCount: 0
        };
        return;
      }

      const fasceOrarie: Array<{
        oraInizio: string;
        oraFine: string;
        durataSlot: number;
        capienzaSlot: number;
      }> = [];

      if (isOrarioSpeciale) {
        const riferimento = dispGiorno[0];
        fasceOrarie.push({
          oraInizio: eccezione!.oraInizio!,
          oraFine: eccezione!.oraFine!,
          durataSlot: this.getDurataSlot(riferimento ?? {}),
          capienzaSlot: this.getCapienzaSlot(riferimento ?? {}),
        });
      } else {
        for (const disp of dispGiorno) {
          fasceOrarie.push({
            oraInizio: disp.oraInizio,
            oraFine: disp.oraFine,
            durataSlot: this.getDurataSlot(disp),
            capienzaSlot: this.getCapienzaSlot(disp),
          });
        }
      }

      let slots: TimeSlot[] = [];
      for (const fascia of fasceOrarie) {
        const fasciaSlots = this.generateSlots(
          dateKey,
          fascia.oraInizio,
          fascia.oraFine,
          fascia.durataSlot,
          fascia.capienzaSlot,
          prenotazioni
        );
        slots = slots.concat(fasciaSlots);
      }

      slots.sort((a, b) => a.time.localeCompare(b.time));
      
      // Calcola stato giorno
      const availableCount = slots.filter(s => s.status === 'free').length;
      let status: DayStatus = 'available';
      
      if (isPast) {
        status = 'closed';
      } else if (availableCount === 0) {
        status = 'full';
      } else if (availableCount < 3) {
        status = 'limited';
      }
      
      result[dateKey] = {
        date: dateKey,
        status,
        slots,
        slotsAvailableCount: availableCount
      };
    });
    
    return result;
  }
  
  /**
   * Genera slot temporali per un giorno
   */
  private static generateSlots(
    data: string,
    oraInizio: string,
    oraFine: string,
    durataMinuti: number,
    capienzaSlot: number,
    prenotazioni: Prenotazione[]
  ): TimeSlot[] {
    const slots: TimeSlot[] = [];
    const [startH, startM] = oraInizio.split(':').map(Number);
    const [endH, endM] = oraFine.split(':').map(Number);
    
    let currentTime = startH * 60 + startM;
    const endTime = endH * 60 + endM;
    
    while (currentTime < endTime) {
      const hours = Math.floor(currentTime / 60);
      const minutes = currentTime % 60;
      const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      
      const prenotazioniSlot = prenotazioni.filter(
        p => p.data === data && p.oraInizio === timeString
      );
      const prenotazione = prenotazioniSlot[0];
      const postiLiberi = capienzaSlot - prenotazioniSlot.length;
      
      slots.push({
        time: timeString,
        status: postiLiberi > 0 ? 'free' : 'booked',
        pazienteNome: prenotazione?.pazienteNome,
        note: prenotazione?.note
      });
      
      currentTime += durataMinuti;
    }
    
    return slots;
  }
  
  /**
   * Converte disponibilità backend in ClinicSettings
   */
  static toClinicSettings(
    disponibilita: Disponibilita[],
    eccezioni: Eccezione[]
  ): ClinicSettings {
    // Estrai giorni lavorativi unici
    const workDays = [...new Set(disponibilita.filter(d => d.attivo).map(d => d.giornoSettimana))];
    
    // Prendi primo orario come default (potrebbero essere diversi per giorno)
    const firstDisp = disponibilita.find(d => d.attivo);
    
    // Estrai date chiusure
    const closedDates = eccezioni
      .filter(e => e.tipo === 'chiusura' || e.tipo === 'ferie' || e.tipo === 'congedo')
      .map(e => e.data);
    
    return {
      workDays: workDays.sort(),
      startHour: firstDisp?.oraInizio || '09:00',
      endHour: firstDisp?.oraFine || '18:00',
      slotDurationMinutes: this.getDurataSlot(firstDisp),
      closedDates
    };
  }
}
