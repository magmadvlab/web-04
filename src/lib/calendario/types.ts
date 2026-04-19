// Types per il calendario MedCal integrato con RicettaZero

export type DayStatus = 'available' | 'limited' | 'full' | 'closed';
export type SlotStatus = 'free' | 'booked' | 'locked';

export interface TimeSlot {
  time: string; // "HH:mm"
  status: SlotStatus;
  pazienteNome?: string;
  note?: string;
}

export interface DayAvailability {
  date: string; // "YYYY-MM-DD"
  status: DayStatus;
  slots: TimeSlot[];
  slotsAvailableCount: number;
}

export interface ClinicSettings {
  workDays: number[]; // 0=Dom, 1=Lun, ..., 6=Sab
  startHour: string; // "09:00"
  endHour: string; // "18:00"
  slotDurationMinutes: number;
  closedDates: string[]; // ["YYYY-MM-DD"]
}

export interface BookingRequest {
  date: Date;
  timeSlot: string;
  patientName: string;
  patientEmail: string;
  notes: string;
}

// Types dal backend RicettaZero
export interface Disponibilita {
  id: number;
  giornoSettimana: number;
  oraInizio: string;
  oraFine: string;
  durataSlot: number;
  postiPerSlot: number;
  dataInizio?: string;
  dataFine?: string;
  note?: string;
  attivo: boolean;
}

export interface Eccezione {
  id: number;
  data: string;
  dataInizio?: string;
  dataFine?: string;
  tipo: string;
  oraInizio?: string;
  oraFine?: string;
  motivo?: string;
}

export interface Prenotazione {
  id: number;
  data: string;
  oraInizio: string;
  oraFine: string;
  pazienteId: number;
  pazienteNome: string;
  stato: string;
  note?: string;
}
