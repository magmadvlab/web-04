'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  isBefore,
  startOfDay
} from 'date-fns';
import { it } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Settings, X, Plus, Trash2, Pencil, ClipboardCheck } from 'lucide-react';
import api from '@/lib/api';
import { CalendarioAdapter } from '@/lib/calendario/adapter';
import type { DayAvailability, Disponibilita, Eccezione } from '@/lib/calendario/types';

interface CalendarioMedCalProps {
  ruolo: 'medico' | 'specialista' | 'laboratorio' | 'professionista' | 'farmacia' | 'fornitore';
  apiBasePath: string;
  titolo?: string;
}

const GIORNI_SETTIMANA = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
const GIORNI_SETTIMANA_FULL = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
const DEFAULT_FORM_DISP = {
  giornoSettimana: 1,
  oraInizio: '09:00',
  oraFine: '19:00',
  durataSlot: 30,
  postiPerSlot: 1,
  dataInizio: '',
  dataFine: '',
  note: '',
};
const DEFAULT_FORM_ECC = {
  isRange: false,
  data: '',
  dataInizio: '',
  dataFine: '',
  tipo: 'chiusura',
  oraInizio: '',
  oraFine: '',
  motivo: '',
};

const CALENDARIO_DISCLAIMER: Record<
  CalendarioMedCalProps['ruolo'],
  { titolo: string; descrizione: string; href: string; cta: string }
> = {
  medico: {
    titolo: 'Conferma richieste visita',
    descrizione: 'Apri le richieste per confermare, rifiutare o riprogrammare gli appuntamenti.',
    href: '/medico/richieste-visita',
    cta: 'Apri richieste',
  },
  specialista: {
    titolo: 'Conferma prenotazioni visite',
    descrizione: 'Apri la pagina richieste per confermare o rifiutare le visite prenotate.',
    href: '/specialista/richieste',
    cta: 'Apri richieste',
  },
  professionista: {
    titolo: 'Conferma richieste appuntamento',
    descrizione: 'Apri le richieste per confermare, rifiutare o riprogrammare gli appuntamenti.',
    href: '/professionista/richieste',
    cta: 'Apri richieste',
  },
  laboratorio: {
    titolo: 'Gestisci richieste analisi',
    descrizione: 'Apri le richieste analisi per accettare o rifiutare le prenotazioni.',
    href: '/laboratorio/richieste-analisi',
    cta: 'Apri richieste',
  },
  farmacia: {
    titolo: 'Gestisci ordini e stati',
    descrizione: 'Apri la pagina ordini per aggiornare lo stato delle prenotazioni.',
    href: '/farmacia/ordini',
    cta: 'Apri ordini',
  },
  fornitore: {
    titolo: 'Gestisci richieste consegna',
    descrizione: 'Apri la pagina clienti per monitorare richieste e consegne.',
    href: '/fornitore/clienti',
    cta: 'Apri clienti',
  },
};

export function CalendarioMedCal({ ruolo, apiBasePath, titolo }: CalendarioMedCalProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [availabilityData, setAvailabilityData] = useState<Record<string, DayAvailability>>({});
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [activeTab, setActiveTab] = useState<'settimanale' | 'eccezioni'>('settimanale');

  // Dati raw per il pannello impostazioni
  const [disponibilita, setDisponibilita] = useState<Disponibilita[]>([]);
  const [eccezioni, setEccezioni] = useState<Eccezione[]>([]);

  // Form states
  const [showAddDisponibilita, setShowAddDisponibilita] = useState(false);
  const [showAddEccezione, setShowAddEccezione] = useState(false);
  const [savingDisp, setSavingDisp] = useState(false);
  const [savingEcc, setSavingEcc] = useState(false);
  const [editingDisponibilitaId, setEditingDisponibilitaId] = useState<number | null>(null);
  const [editingEccezioneId, setEditingEccezioneId] = useState<number | null>(null);
  const [applyToMultipleDays, setApplyToMultipleDays] = useState(false);
  const [selectedWeekDays, setSelectedWeekDays] = useState<number[]>([
    DEFAULT_FORM_DISP.giornoSettimana,
  ]);

  const [formDisp, setFormDisp] = useState(DEFAULT_FORM_DISP);

  const [formEcc, setFormEcc] = useState(DEFAULT_FORM_ECC);
  const calendarioDisclaimer = CALENDARIO_DISCLAIMER[ruolo];
  const usesBooleanEccezioniApi =
    ruolo === 'fornitore' || ruolo === 'laboratorio' || ruolo === 'professionista';

  const formatReadableDate = (value?: string) => {
    if (!value) return '';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '';
    return parsed.toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const formatPeriodoLabel = (start?: string, end?: string) => {
    if (start && end && start !== end) {
      return `${formatReadableDate(start)} - ${formatReadableDate(end)}`;
    }
    if (start) {
      return `Dal ${formatReadableDate(start)}`;
    }
    if (end) {
      return `Fino al ${formatReadableDate(end)}`;
    }
    return 'Sempre attivo';
  };

  const toggleWeekDaySelection = (giorno: number) => {
    setSelectedWeekDays((prev) => {
      const next = prev.includes(giorno)
        ? prev.filter((value) => value !== giorno)
        : [...prev, giorno];
      return next.length > 0 ? next : [formDisp.giornoSettimana];
    });
  };

  const applyPeriodoPreset = (preset: 'current_month' | 'next_3_months' | 'always') => {
    if (preset === 'always') {
      setFormDisp((prev) => ({
        ...prev,
        dataInizio: '',
        dataFine: '',
      }));
      return;
    }

    const now = new Date();
    const start = startOfMonth(now);
    const end = preset === 'current_month' ? endOfMonth(now) : endOfMonth(addMonths(now, 2));
    setFormDisp((prev) => ({
      ...prev,
      dataInizio: format(start, 'yyyy-MM-dd'),
      dataFine: format(end, 'yyyy-MM-dd'),
    }));
  };

  useEffect(() => {
    loadCalendarData();
  }, [currentDate]);

  const resetDispForm = () => {
    setFormDisp({ ...DEFAULT_FORM_DISP });
    setApplyToMultipleDays(false);
    setSelectedWeekDays([DEFAULT_FORM_DISP.giornoSettimana]);
  };
  const resetEccForm = () => setFormEcc({ ...DEFAULT_FORM_ECC });

  const closeDisponibilitaModal = () => {
    setShowAddDisponibilita(false);
    setEditingDisponibilitaId(null);
    resetDispForm();
  };

  const closeEccezioneModal = () => {
    setShowAddEccezione(false);
    setEditingEccezioneId(null);
    resetEccForm();
  };

  const openAddDisponibilita = () => {
    setEditingDisponibilitaId(null);
    resetDispForm();
    setShowAddDisponibilita(true);
  };

  const openAddEccezione = () => {
    setEditingEccezioneId(null);
    resetEccForm();
    setShowAddEccezione(true);
  };

  const normalizeEccezioneTipo = (tipo?: string) => {
    if (!tipo) return 'chiusura';
    if (tipo === 'apertura_straordinaria' || tipo === 'orario_ridotto') {
      return 'orario_speciale';
    }
    return tipo;
  };

  const openEditDisponibilita = (disp: Disponibilita) => {
    setEditingDisponibilitaId(disp.id);
    setApplyToMultipleDays(false);
    setSelectedWeekDays([disp.giornoSettimana]);
    setFormDisp({
      giornoSettimana: disp.giornoSettimana,
      oraInizio: disp.oraInizio,
      oraFine: disp.oraFine,
      durataSlot: disp.durataSlot || (disp as any).slotDurata || 30,
      postiPerSlot: disp.postiPerSlot || (disp as any).maxPrenotazioniPerSlot || 1,
      dataInizio: (disp as any).dataInizio?.slice(0, 10) || '',
      dataFine: (disp as any).dataFine?.slice(0, 10) || '',
      note: disp.note || '',
    });
    setShowAddDisponibilita(true);
  };

  const openEditEccezione = (ecc: Eccezione) => {
    const startDate = ecc.dataInizio?.slice(0, 10) || ecc.data?.slice(0, 10) || '';
    const endDate = ecc.dataFine?.slice(0, 10) || '';
    const isRange = !!(startDate && endDate && startDate !== endDate);

    setEditingEccezioneId(ecc.id);
    setFormEcc({
      isRange,
      data: isRange ? '' : startDate,
      dataInizio: isRange ? startDate : '',
      dataFine: isRange ? endDate : '',
      tipo: normalizeEccezioneTipo(ecc.tipo),
      oraInizio: ecc.oraInizio || '',
      oraFine: ecc.oraFine || '',
      motivo: ecc.motivo || '',
    });
    setShowAddEccezione(true);
  };

  const isMethodNotSupported = (error: any) => {
    const status = error?.response?.status;
    return status === 404 || status === 405 || status === 501;
  };

  const toDateKey = (value: string | Date | undefined | null): string => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return format(date, 'yyyy-MM-dd');
  };

  const toTimeKey = (value: string | Date | undefined | null): string => {
    if (!value) return '';
    if (typeof value === 'string' && /^\d{2}:\d{2}/.test(value)) {
      return value.slice(0, 5);
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`;
  };

  const buildDisponibilitaPayload = (value = formDisp): Record<string, unknown> => {
    const periodoPayload = {
      ...(value.dataInizio ? { dataInizio: value.dataInizio, data: value.dataInizio } : {}),
      ...(value.dataFine ? { dataFine: value.dataFine } : {}),
    };

    if (ruolo === 'professionista') {
      return {
        giornoSettimana: value.giornoSettimana,
        oraInizio: value.oraInizio,
        oraFine: value.oraFine,
        slotDurata: value.durataSlot,
        maxPrenotazioniPerSlot: value.postiPerSlot,
        postiPerSlot: value.postiPerSlot,
        ...periodoPayload,
      };
    }

    if (ruolo === 'laboratorio') {
      return {
        giornoSettimana: value.giornoSettimana,
        oraInizio: value.oraInizio,
        oraFine: value.oraFine,
        slotDurata: value.durataSlot,
        maxPrenotazioniPerSlot: value.postiPerSlot,
        ...periodoPayload,
        ...(value.note ? { note: value.note } : {}),
      };
    }

    if (ruolo === 'fornitore') {
      return {
        giornoSettimana: value.giornoSettimana,
        oraInizio: value.oraInizio,
        oraFine: value.oraFine,
        slotDurata: value.durataSlot,
        maxOrdiniPerSlot: value.postiPerSlot,
        ...periodoPayload,
      };
    }

    return {
      giornoSettimana: value.giornoSettimana,
      oraInizio: value.oraInizio,
      oraFine: value.oraFine,
      durataSlot: value.durataSlot,
      postiPerSlot: value.postiPerSlot,
      ...periodoPayload,
      ...(value.note ? { note: value.note } : {}),
    };
  };

  const loadCalendarData = async () => {
    try {
      setLoading(true);
      const monthStart = format(startOfMonth(currentDate), 'yyyy-MM-dd');
      const monthEnd = format(endOfMonth(currentDate), 'yyyy-MM-dd');

      const [dispRes, eccRes, prenRes] = await Promise.all([
        api.get(`${apiBasePath}/disponibilita`),
        api.get(`${apiBasePath}/eccezioni`),
        ruolo === 'fornitore'
          ? Promise.all([
              api.get(`/fornitore/consegne?dataInizio=${monthStart}&dataFine=${monthEnd}`).catch(() => ({ data: [] })),
              api.get(`/fornitore/richieste-consegna?dataInizio=${monthStart}&dataFine=${monthEnd}`).catch(() => ({ data: [] })),
            ]).then(([consegneRes, richiesteRes]) => {
              const unwrap = (payload: any) =>
                Array.isArray(payload?.data)
                  ? payload.data
                  : Array.isArray(payload?.data?.data)
                    ? payload.data.data
                    : [];

              const consegne = unwrap(consegneRes)
                .map((c: any) => {
                  const data = toDateKey(c.dataConsegna);
                  const oraInizio = toTimeKey(c.oraConsegna);
                  if (!data || !oraInizio) return null;
                  return {
                    id: `consegna-${c.id}`,
                    data,
                    oraInizio,
                    oraFine: oraInizio,
                    pazienteId: Number(c.clienteId || 0),
                    pazienteNome: c.clienteNome || `Cliente #${c.clienteId || '-'}`,
                    stato: c.stato || 'confermata',
                    note: c.note,
                  };
                })
                .filter((item: any) => item !== null);

              const richieste = unwrap(richiesteRes)
                .map((r: any) => {
                  const data = toDateKey(r.dataRichiesta);
                  const oraInizio = toTimeKey(r.oraInizio);
                  if (!data || !oraInizio) return null;
                  return {
                    id: `richiesta-${r.id}`,
                    data,
                    oraInizio,
                    oraFine: oraInizio,
                    pazienteId: Number(r.clienteId || 0),
                    pazienteNome: r.clienteNome || `Cliente #${r.clienteId || '-'}`,
                    stato: r.stato || 'in_attesa',
                    note: r.note,
                  };
                })
                .filter((item: any) => item !== null);

              return { data: [...richieste, ...consegne] };
            })
          : ruolo === 'laboratorio'
            ? api
                .get('/laboratori/dashboard/prenotazioni')
                .catch(() => ({ data: [] }))
            : api
                .get(`${apiBasePath}/prenotazioni?anno=${currentDate.getFullYear()}&mese=${currentDate.getMonth() + 1}`)
                .catch(() => ({ data: [] })),
      ]);

      const toArray = (value: any): any[] => {
        if (Array.isArray(value)) {
          return value;
        }
        if (Array.isArray(value?.data)) {
          return value.data;
        }
        if (Array.isArray(value?.items)) {
          return value.items;
        }
        if (Array.isArray(value?.prenotazioni)) {
          return value.prenotazioni;
        }
        if (Array.isArray(value?.risultati)) {
          return value.risultati;
        }
        return [];
      };

      const rawDispData = toArray(dispRes.data);
      const rawEccData = toArray(eccRes.data);
      const rawPrenData = toArray(prenRes.data);

      const dispData = rawDispData.map((d: any) => ({
        ...d,
        oraInizio: toTimeKey(d.oraInizio) || d.oraInizio,
        oraFine: toTimeKey(d.oraFine) || d.oraFine,
        durataSlot: d.durataSlot ?? d.slotDurata ?? 30,
        postiPerSlot: d.postiPerSlot ?? d.maxPrenotazioniPerSlot ?? d.maxOrdiniPerSlot ?? 1,
        dataInizio: toDateKey(d.dataInizio) || toDateKey(d.data) || undefined,
        dataFine: toDateKey(d.dataFine) || undefined,
        attivo: d.attivo ?? true,
      }));

      const eccData = rawEccData
        .map((e: any) => ({
          ...e,
          data: toDateKey(e.data) || toDateKey(e.dataInizio),
          dataInizio: toDateKey(e.dataInizio) || toDateKey(e.data),
          dataFine: toDateKey(e.dataFine),
          oraInizio: toTimeKey(e.oraInizio) || e.oraInizio,
          oraFine: toTimeKey(e.oraFine) || e.oraFine,
          tipo:
            e.tipo ??
            (typeof e.disponibile === 'boolean'
              ? (e.disponibile ? 'orario_speciale' : 'chiusura')
              : 'chiusura'),
        }))
        .filter((e: any) => e.data);

      const prenData = rawPrenData
        .filter((p: any) => p && typeof p === 'object')
        .map((p: any) => {
          const dateTimeSource =
            p.dataOraAppuntamento || p.dataAppuntamento || p.dataPrenotazione;
          return {
            ...p,
            data:
              toDateKey(p.data) ||
              toDateKey(p.dataRichiesta) ||
              toDateKey(dateTimeSource),
            oraInizio:
              toTimeKey(p.oraInizio) ||
              toTimeKey(p.orario) ||
              toTimeKey(dateTimeSource),
          };
        })
        .filter((p: any) => p.data && p.oraInizio);

      setDisponibilita(dispData);
      setEccezioni(eccData);

      const monthData = CalendarioAdapter.generateMonthAvailability(
        dispData,
        eccData,
        prenData,
        currentDate.getFullYear(),
        currentDate.getMonth()
      );

      setAvailabilityData(monthData);
    } catch (error) {
      console.error('Errore caricamento calendario:', error);
      setAvailabilityData({});
    } finally {
      setLoading(false);
    }
  };

  const handlePrevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const handleToday = () => setCurrentDate(new Date());

  const handleDateClick = (date: Date) => {
    if (isBefore(date, startOfDay(new Date()))) return;
    setSelectedDate(date);
  };

  const calendarDays = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  };

  const getDayStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-green-50 border-green-200 hover:bg-green-100';
      case 'limited': return 'bg-yellow-50 border-yellow-200 hover:bg-yellow-100';
      case 'full': return 'bg-red-50 border-red-200';
      case 'closed': return 'bg-gray-50 border-gray-200';
      default: return 'bg-white border-gray-200';
    }
  };

  // --- CRUD Disponibilità ---
  const upsertDisponibilitaWithFallback = async (id: number, payload: Record<string, unknown>) => {
    try {
      await api.put(`${apiBasePath}/disponibilita/${id}`, payload);
    } catch (error: any) {
      if (!isMethodNotSupported(error)) {
        throw error;
      }

      const createRes = await api.post(`${apiBasePath}/disponibilita`, payload);
      const newId = createRes?.data?.id;

      if (!newId || newId !== id) {
        await api.delete(`${apiBasePath}/disponibilita/${id}`);
      }
    }
  };

  const handleSaveDisponibilita = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingDisp(true);
    try {
      const payload = buildDisponibilitaPayload(formDisp);

      if (editingDisponibilitaId !== null) {
        await upsertDisponibilitaWithFallback(editingDisponibilitaId, payload);
      } else {
        const targetDays =
          applyToMultipleDays && selectedWeekDays.length > 0
            ? selectedWeekDays
            : [formDisp.giornoSettimana];

        for (const giorno of targetDays) {
          await api.post(`${apiBasePath}/disponibilita`, {
            ...payload,
            giornoSettimana: giorno,
          });
        }
      }

      closeDisponibilitaModal();
      await loadCalendarData();
    } catch (error) {
      console.error('Errore salvataggio disponibilità:', error);
      alert('Errore durante il salvataggio dell\'orario');
    } finally {
      setSavingDisp(false);
    }
  };

  const handleDeleteDisponibilita = async (id: number) => {
    if (!confirm('Eliminare questo orario?')) return;
    try {
      await api.delete(`${apiBasePath}/disponibilita/${id}`);
      await loadCalendarData();
    } catch (error) {
      console.error('Errore eliminazione:', error);
    }
  };

  // --- CRUD Eccezioni ---
  const upsertEccezioneWithFallback = async (id: number, payload: Record<string, unknown>) => {
    try {
      await api.put(`${apiBasePath}/eccezioni/${id}`, payload);
    } catch (error: any) {
      if (!isMethodNotSupported(error)) {
        throw error;
      }

      const createRes = await api.post(`${apiBasePath}/eccezioni`, payload);
      const newId = createRes?.data?.id;

      if (!newId || newId !== id) {
        await api.delete(`${apiBasePath}/eccezioni/${id}`);
      }
    }
  };

  const handleSaveEccezione = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingEcc(true);
    try {
      const buildDateRange = (start: string, end: string): string[] => {
        const dates: string[] = [];
        let current = new Date(`${start}T00:00:00`);
        const endDate = new Date(`${end}T00:00:00`);
        while (current <= endDate) {
          dates.push(format(current, 'yyyy-MM-dd'));
          current.setDate(current.getDate() + 1);
        }
        return dates;
      };

      if (usesBooleanEccezioniApi) {
        const basePayload: Record<string, unknown> = {
          disponibile: formEcc.tipo === 'orario_speciale',
        };

        if (formEcc.tipo === 'orario_speciale' && formEcc.oraInizio) {
          basePayload.oraInizio = formEcc.oraInizio;
          basePayload.oraFine = formEcc.oraFine;
        }

        if (formEcc.motivo) {
          basePayload.motivo = formEcc.motivo;
        }

        if (editingEccezioneId !== null) {
          const isRangeEdit = formEcc.isRange && !!formEcc.dataInizio && !!formEcc.dataFine;
          const singleDate = formEcc.data || formEcc.dataInizio;
          if (!singleDate) {
            alert('Seleziona una data');
            setSavingEcc(false);
            return;
          }

          if (ruolo === 'fornitore') {
            await api.delete(`${apiBasePath}/eccezioni/${editingEccezioneId}`);
            await api.post(`${apiBasePath}/eccezioni`, {
              ...basePayload,
              data: singleDate,
            });
          } else {
            const payload: Record<string, unknown> = {
              ...basePayload,
              data: singleDate,
            };
            if (isRangeEdit) {
              payload.dataInizio = formEcc.dataInizio;
              payload.dataFine = formEcc.dataFine;
            }
            await upsertEccezioneWithFallback(editingEccezioneId, payload);
          }
        } else if (formEcc.isRange) {
          if (!formEcc.dataInizio || !formEcc.dataFine) {
            alert('Seleziona date inizio e fine');
            setSavingEcc(false);
            return;
          }

          if (ruolo === 'professionista') {
            await api.post(`${apiBasePath}/eccezioni`, {
              ...basePayload,
              data: formEcc.dataInizio,
              dataFine: formEcc.dataFine,
            });
          } else {
            const rangeDates = buildDateRange(formEcc.dataInizio, formEcc.dataFine);
            for (const date of rangeDates) {
              await api.post(`${apiBasePath}/eccezioni`, {
                ...basePayload,
                data: date,
              });
            }
          }
        } else {
          if (!formEcc.data) {
            alert('Seleziona una data');
            setSavingEcc(false);
            return;
          }
          await api.post(`${apiBasePath}/eccezioni`, {
            ...basePayload,
            data: formEcc.data,
          });
        }
      } else {
        const payload: Record<string, unknown> = {
          tipo: formEcc.tipo,
        };

        if (formEcc.isRange) {
          if (!formEcc.dataInizio || !formEcc.dataFine) {
            alert('Seleziona date inizio e fine');
            setSavingEcc(false);
            return;
          }
          payload.dataInizio = formEcc.dataInizio;
          payload.dataFine = formEcc.dataFine;
          payload.data = formEcc.dataInizio;
        } else {
          if (!formEcc.data) {
            alert('Seleziona una data');
            setSavingEcc(false);
            return;
          }
          payload.data = formEcc.data;
        }

        if (formEcc.tipo === 'orario_speciale' && formEcc.oraInizio) {
          payload.oraInizio = formEcc.oraInizio;
          payload.oraFine = formEcc.oraFine;
        }

        if (formEcc.motivo) {
          payload.motivo = formEcc.motivo;
        }

        if (editingEccezioneId !== null) {
          await upsertEccezioneWithFallback(editingEccezioneId, payload);
        } else {
          await api.post(`${apiBasePath}/eccezioni`, payload);
        }
      }

      closeEccezioneModal();
      await loadCalendarData();
    } catch (error) {
      console.error('Errore salvataggio eccezione:', error);
      alert('Errore durante il salvataggio');
    } finally {
      setSavingEcc(false);
    }
  };

  const handleDeleteEccezione = async (id: number) => {
    if (!confirm('Eliminare questa eccezione?')) return;
    try {
      await api.delete(`${apiBasePath}/eccezioni/${id}`);
      await loadCalendarData();
    } catch (error) {
      console.error('Errore eliminazione:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Caricamento calendario...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {titolo || 'Calendario Disponibilità'}
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                {format(currentDate, 'MMMM yyyy', { locale: it })}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleToday}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Oggi
              </button>

              <div className="flex items-center gap-1">
                <button onClick={handlePrevMonth} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button onClick={handleNextMonth} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              <button
                onClick={() => setShowSettings(true)}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                title="Impostazioni"
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {calendarioDisclaimer && (
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-start gap-3">
              <ClipboardCheck className="w-5 h-5 mt-0.5 text-amber-700" />
              <div>
                <p className="font-semibold text-amber-900">
                  {calendarioDisclaimer.titolo}
                </p>
                <p className="text-sm text-amber-800">
                  {calendarioDisclaimer.descrizione}
                </p>
              </div>
            </div>

            <Link
              href={calendarioDisclaimer.href}
              className="inline-flex items-center justify-center px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-amber-600 text-white hover:bg-amber-700"
            >
              {calendarioDisclaimer.cta}
            </Link>
          </div>
        )}

        {/* Calendario Grid */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="grid grid-cols-7 gap-2 mb-2">
            {GIORNI_SETTIMANA.map((giorno, idx) => (
              <div key={idx} className="text-center text-sm font-medium text-gray-600 py-2">
                {giorno}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-2">
            {calendarDays().map((day, idx) => {
              const dateKey = format(day, 'yyyy-MM-dd');
              const dayData = availabilityData[dateKey];
              const isCurrentMonth = isSameMonth(day, currentDate);
              const isCurrentDay = isToday(day);
              const isPast = isBefore(day, startOfDay(new Date()));

              return (
                <button
                  key={idx}
                  onClick={() => handleDateClick(day)}
                  disabled={!isCurrentMonth || isPast || dayData?.status === 'closed'}
                  className={`
                    relative min-h-[100px] p-3 border-2 rounded-lg text-left transition-all
                    ${!isCurrentMonth ? 'opacity-30' : ''}
                    ${isCurrentDay ? 'ring-2 ring-blue-500' : ''}
                    ${isPast || dayData?.status === 'closed' ? 'cursor-not-allowed' : 'cursor-pointer'}
                    ${dayData ? getDayStatusColor(dayData.status) : 'bg-white border-gray-200'}
                  `}
                >
                  <div className="font-semibold text-gray-900 mb-1">
                    {format(day, 'd')}
                  </div>

                  {dayData && dayData.status !== 'closed' && (
                    <div className="text-xs space-y-1">
                      <div className="text-gray-600">{dayData.slots.length} slot</div>
                      <div className={`font-medium ${dayData.slotsAvailableCount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {dayData.slotsAvailableCount} liberi
                      </div>
                    </div>
                  )}

                  {dayData?.status === 'closed' && (
                    <div className="text-xs text-gray-500">Chiuso</div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Legenda */}
        <div className="mt-6 bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-100 border-2 border-green-200 rounded"></div>
              <span className="text-gray-600">Disponibile</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-yellow-100 border-2 border-yellow-200 rounded"></div>
              <span className="text-gray-600">Pochi posti</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-100 border-2 border-red-200 rounded"></div>
              <span className="text-gray-600">Completo</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-gray-100 border-2 border-gray-200 rounded"></div>
              <span className="text-gray-600">Chiuso</span>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Dettaglio Giorno */}
      {selectedDate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-semibold text-gray-900">
                  {format(selectedDate, 'EEEE d MMMM yyyy', { locale: it })}
                </h3>
                <p className="text-sm text-gray-600 mt-1">Slot disponibili</p>
              </div>
              <button onClick={() => setSelectedDate(null)} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              {(() => {
                const dateKey = format(selectedDate, 'yyyy-MM-dd');
                const dayData = availabilityData[dateKey];
                if (!dayData || dayData.slots.length === 0) {
                  return <p className="text-center text-gray-500 py-8">Nessuno slot disponibile per questo giorno</p>;
                }
                return (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {dayData.slots.map((slot, idx) => (
                      <button
                        key={idx}
                        disabled={slot.status !== 'free'}
                        className={`p-4 rounded-lg border-2 text-center font-medium transition-all ${slot.status === 'free'
                          ? 'border-green-200 bg-green-50 hover:bg-green-100 hover:border-green-300 cursor-pointer'
                          : 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
                          }`}
                      >
                        <div className="text-lg">{slot.time}</div>
                        {slot.status === 'booked' && <div className="text-xs mt-1">Prenotato</div>}
                      </button>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Modal Impostazioni Calendario */}
      {showSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex justify-between items-center z-10">
              <div>
                <h3 className="text-xl font-semibold text-gray-900">Impostazioni Calendario</h3>
                <p className="text-sm text-gray-600 mt-1">Configura orari di disponibilità e gestisci eccezioni</p>
              </div>
              <button onClick={() => setShowSettings(false)} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              {/* Tabs */}
              <div className="flex border-b border-gray-200 mb-6">
                <button
                  onClick={() => setActiveTab('settimanale')}
                  className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${activeTab === 'settimanale'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                >
                  Orari Settimanali
                </button>
                <button
                  onClick={() => setActiveTab('eccezioni')}
                  className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${activeTab === 'eccezioni'
                    ? 'border-orange-500 text-orange-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                >
                  Ferie & Chiusure
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Contenuto Tab */}
                {activeTab === 'settimanale' && (
                  <div className="lg:col-span-2">
                    <div className="mb-4 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                      Orari settimanali replicati automaticamente su tutti i mesi. Usa <strong>Valido dal/al</strong> per pianificare periodi specifici.
                    </div>
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="text-lg font-semibold text-gray-900">Configurazione Settimanale</h4>
                      <button
                        onClick={openAddDisponibilita}
                        className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
                      >
                        <Plus className="w-4 h-4" /> Aggiungi Orario
                      </button>
                    </div>

                    {/* Lista Orari Esistenti */}
                    {disponibilita.length === 0 ? (
                      <div className="text-center py-12 text-gray-500 border-2 border-dashed border-gray-200 rounded-lg bg-gray-50">
                        <p className="font-medium text-lg">Nessun orario configurato</p>
                        <p className="text-sm mt-1">Aggiungi i tuoi orari di disponibilità per iniziare a ricevere appuntamenti.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {disponibilita
                          .sort((a, b) => {
                            // Ordina per giorno e poi ora
                            if (a.giornoSettimana !== b.giornoSettimana) return a.giornoSettimana - b.giornoSettimana;
                            return a.oraInizio.localeCompare(b.oraInizio);
                          })
                          .map((disp) => (
                            <div key={disp.id} className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors bg-white shadow-sm">
                              {(() => {
                                const maxPerSlot =
                                  disp.postiPerSlot ||
                                  (disp as any).maxPrenotazioniPerSlot ||
                                  (disp as any).maxOrdiniPerSlot;
                                return (
                              <div className="flex justify-between items-start">
                                <div className="flex-1">
                                  <div className="font-semibold text-gray-900 flex items-center gap-2">
                                    <span className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-xs font-bold uppercase">
                                      {GIORNI_SETTIMANA[disp.giornoSettimana].substring(0, 2)}
                                    </span>
                                    {GIORNI_SETTIMANA_FULL[disp.giornoSettimana]}
                                  </div>
                                  <div className="ml-10">
                                    <div className="text-lg font-medium text-gray-800 mt-1">
                                      {disp.oraInizio} - {disp.oraFine}
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1 flex flex-wrap gap-2">
                                      <span className="bg-gray-100 px-2 py-1 rounded">
                                        Slot: {disp.durataSlot || (disp as any).slotDurata || '?'} min
                                      </span>
                                      {maxPerSlot && (
                                        <span className="bg-gray-100 px-2 py-1 rounded">
                                          Max {maxPerSlot} {ruolo === 'fornitore' ? 'ordini' : 'pz'}
                                        </span>
                                      )}
                                      <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded">
                                        Valido: {formatPeriodoLabel((disp as any).dataInizio, (disp as any).dataFine)}
                                      </span>
                                    </div>
                                    {disp.note && (
                                      <div className="text-xs text-gray-500 mt-2 italic border-l-2 border-gray-300 pl-2">
                                        {disp.note}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => openEditDisponibilita(disp)}
                                    className="p-2 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
                                    title="Modifica"
                                  >
                                    <Pencil className="w-5 h-5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteDisponibilita(disp.id)}
                                    className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                                    title="Elimina"
                                  >
                                    <Trash2 className="w-5 h-5" />
                                  </button>
                                </div>
                              </div>
                                );
                              })()}
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'eccezioni' && (
                  <div className="lg:col-span-2">
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="text-lg font-semibold text-gray-900">Eccezioni, Ferie e Chiusure</h4>
                      <button
                        onClick={openAddEccezione}
                        className="flex items-center gap-1 px-3 py-2 bg-orange-600 text-white text-sm rounded-lg hover:bg-orange-700"
                      >
                        <Plus className="w-4 h-4" /> Aggiungi Eccezione
                      </button>
                    </div>

                    {eccezioni.length === 0 ? (
                      <div className="text-center py-12 text-gray-500 border-2 border-dashed border-gray-200 rounded-lg bg-gray-50">
                        <p className="font-medium text-lg">Nessuna eccezione configurata</p>
                        <p className="text-sm mt-1">Aggiungi ferie, chiusure straordinarie o modifiche orarie temporanee.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {eccezioni
                          .sort((a, b) => {
                            const aStart = (a.dataInizio || a.data) ?? '';
                            const bStart = (b.dataInizio || b.data) ?? '';
                            return new Date(aStart).getTime() - new Date(bStart).getTime();
                          })
                          .map((ecc) => (
                            <div key={ecc.id} className="border border-gray-200 rounded-lg p-4 hover:border-orange-300 transition-colors bg-white shadow-sm">
                              <div className="flex justify-between items-start">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className={`px-2 py-1 rounded text-xs font-semibold uppercase tracking-wide ${ecc.tipo === 'chiusura' ? 'bg-red-100 text-red-700' :
                                      ecc.tipo === 'ferie' ? 'bg-purple-100 text-purple-700' :
                                        'bg-yellow-100 text-yellow-700'
                                      }`}>
                                      {ecc.tipo.replace('_', ' ')}
                                    </span>
                                  </div>
                                  <div className="font-medium text-gray-900 text-lg">
                                    {(() => {
                                      const startDate = ecc.dataInizio || ecc.data;
                                      const endDate = ecc.dataFine;
                                      if (startDate && endDate && startDate !== endDate) {
                                        return `${formatReadableDate(startDate)} - ${formatReadableDate(endDate)}`;
                                      }
                                      return new Date(startDate).toLocaleDateString('it-IT', {
                                        weekday: 'long',
                                        day: 'numeric',
                                        month: 'long',
                                        year: 'numeric',
                                      });
                                    })()}
                                  </div>

                                  {ecc.tipo === 'orario_speciale' && ecc.oraInizio && (
                                    <div className="text-sm font-mono text-gray-700 mt-1 bg-gray-50 inline-block px-2 py-1 rounded border border-gray-200">
                                      {ecc.oraInizio} - {ecc.oraFine}
                                    </div>
                                  )}

                                  {ecc.motivo && (
                                    <div className="text-sm text-gray-600 mt-2 italic">
                                      "{ecc.motivo}"
                                    </div>
                                  )}
                                </div>
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => openEditEccezione(ecc)}
                                    className="p-2 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
                                    title="Modifica"
                                  >
                                    <Pencil className="w-5 h-5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteEccezione(ecc.id)}
                                    className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                                    title="Elimina"
                                  >
                                    <Trash2 className="w-5 h-5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Aggiungi Disponibilità - Stessa logica ma layout migliorato opzionalmente */}
      {showAddDisponibilita && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-xl font-semibold mb-4 text-gray-900">
              {editingDisponibilitaId !== null ? 'Modifica Orario Settimanale' : 'Aggiungi Orario Settimanale'}
            </h3>
            <form onSubmit={handleSaveDisponibilita} className="space-y-4">
              {editingDisponibilitaId === null && (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <label className="text-sm font-medium text-gray-700">
                      Applica lo stesso orario a più giorni
                    </label>
                    <input
                      type="checkbox"
                      checked={applyToMultipleDays}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setApplyToMultipleDays(checked);
                        setSelectedWeekDays([formDisp.giornoSettimana]);
                      }}
                      className="h-4 w-4"
                    />
                  </div>
                  {applyToMultipleDays && (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {GIORNI_SETTIMANA_FULL.map((giorno, idx) => (
                        <button
                          key={giorno}
                          type="button"
                          onClick={() => toggleWeekDaySelection(idx)}
                          className={`rounded-md border px-2 py-1 text-sm text-left transition-colors ${
                            selectedWeekDays.includes(idx)
                              ? 'border-blue-300 bg-blue-50 text-blue-800'
                              : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          {giorno}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Giorno della Settimana</label>
                <select
                  value={formDisp.giornoSettimana}
                  onChange={(e) => {
                    const selectedDay = parseInt(e.target.value, 10);
                    setFormDisp({ ...formDisp, giornoSettimana: selectedDay });
                    if (!applyToMultipleDays) {
                      setSelectedWeekDays([selectedDay]);
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {GIORNI_SETTIMANA_FULL.map((giorno, idx) => (
                    <option key={idx} value={idx}>{giorno}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ora Inizio</label>
                  <input
                    type="time"
                    value={formDisp.oraInizio}
                    onChange={(e) => setFormDisp({ ...formDisp, oraInizio: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ora Fine</label>
                  <input
                    type="time"
                    value={formDisp.oraFine}
                    onChange={(e) => setFormDisp({ ...formDisp, oraFine: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Durata Slot (min)</label>
                  <input
                    type="number"
                    value={formDisp.durataSlot}
                    onChange={(e) => setFormDisp({ ...formDisp, durataSlot: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    min="5"
                    step="5"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {ruolo === 'laboratorio'
                      ? 'Prenotazioni Max'
                      : ruolo === 'fornitore'
                        ? 'Ordini per Slot'
                        : 'Posti per Slot'}
                  </label>
                  <input
                    type="number"
                    value={formDisp.postiPerSlot}
                    onChange={(e) => setFormDisp({ ...formDisp, postiPerSlot: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    min="1"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valido dal (opzionale)</label>
                  <input
                    type="date"
                    value={formDisp.dataInizio}
                    onChange={(e) => setFormDisp({ ...formDisp, dataInizio: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valido al (opzionale)</label>
                  <input
                    type="date"
                    value={formDisp.dataFine}
                    onChange={(e) => setFormDisp({ ...formDisp, dataFine: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    min={formDisp.dataInizio || undefined}
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => applyPeriodoPreset('current_month')}
                  className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                >
                  Questo mese
                </button>
                <button
                  type="button"
                  onClick={() => applyPeriodoPreset('next_3_months')}
                  className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                >
                  Prossimi 3 mesi
                </button>
                <button
                  type="button"
                  onClick={() => applyPeriodoPreset('always')}
                  className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                >
                  Senza scadenza
                </button>
              </div>
              <p className="text-xs text-gray-500">
                Se lasci vuoto il periodo, l'orario resta attivo in modo continuativo.
              </p>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Note (opzionale)</label>
                <input
                  type="text"
                  value={formDisp.note}
                  onChange={(e) => setFormDisp({ ...formDisp, note: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="Es: Solo appuntamenti urgenti"
                />
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-100 mt-4">
                <button
                  type="button"
                  onClick={closeDisponibilitaModal}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 font-medium"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={savingDisp}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
                >
                  {savingDisp
                    ? 'Salvataggio...'
                    : editingDisponibilitaId !== null
                      ? 'Aggiorna Orario'
                      : 'Salva Orario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Aggiungi Eccezione - Aggiornata con Range */}
      {showAddEccezione && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-xl font-semibold mb-4 text-gray-900">
              {editingEccezioneId !== null ? 'Modifica Eccezione' : 'Aggiungi Eccezione'}
            </h3>
            <form onSubmit={handleSaveEccezione} className="space-y-4">

              {/* Toggle Periodo/Singolo */}
              <div className="flex items-center gap-2 mb-4 bg-gray-100 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setFormEcc({ ...formEcc, isRange: false })}
                  className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${!formEcc.isRange ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Giorno Singolo
                </button>
                <button
                  type="button"
                  onClick={() => setFormEcc({ ...formEcc, isRange: true })}
                  className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${formEcc.isRange ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Periodo (Dal - Al)
                </button>
              </div>

              {formEcc.isRange ? (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Dal</label>
                    <input
                      type="date"
                      value={formEcc.dataInizio}
                      onChange={(e) => setFormEcc({ ...formEcc, dataInizio: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Al</label>
                    <input
                      type="date"
                      value={formEcc.dataFine}
                      onChange={(e) => setFormEcc({ ...formEcc, dataFine: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                      required
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data</label>
                  <input
                    type="date"
                    value={formEcc.data}
                    onChange={(e) => setFormEcc({ ...formEcc, data: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                    required
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo Eccezione</label>
                <select
                  value={formEcc.tipo}
                  onChange={(e) => setFormEcc({ ...formEcc, tipo: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  {usesBooleanEccezioniApi ? (
                    <>
                      <option value="chiusura">🔒 Chiusura Completa</option>
                      <option value="orario_speciale">⏰ Orario Speciale</option>
                    </>
                  ) : (
                    <>
                      <option value="chiusura">🔒 Chiusura Completa</option>
                      <option value="orario_speciale">⏰ Orario Speciale</option>
                      <option value="ferie">🏖️ Ferie</option>
                      <option value="congedo">🤒 Congedo/Malattia</option>
                      <option value="formazione">📚 Formazione/Corso</option>
                    </>
                  )}
                </select>
              </div>

              {formEcc.tipo === 'orario_speciale' && (
                <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                  <p className="text-xs text-yellow-800 mb-2 font-medium">Imposta orario di apertura speciale:</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Ora Inizio</label>
                      <input
                        type="time"
                        value={formEcc.oraInizio}
                        onChange={(e) => setFormEcc({ ...formEcc, oraInizio: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg sm:text-sm"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Ora Fine</label>
                      <input
                        type="time"
                        value={formEcc.oraFine}
                        onChange={(e) => setFormEcc({ ...formEcc, oraFine: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg sm:text-sm"
                        required
                      />
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Motivo (opzionale)</label>
                <textarea
                  value={formEcc.motivo}
                  onChange={(e) => setFormEcc({ ...formEcc, motivo: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  rows={3}
                  placeholder="Es: Ferie estive, Ponte festivo..."
                />
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-100 mt-4">
                <button
                  type="button"
                  onClick={closeEccezioneModal}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 font-medium"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={savingEcc}
                  className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 font-medium"
                >
                  {savingEcc
                    ? 'Salvataggio...'
                    : editingEccezioneId !== null
                      ? 'Aggiorna Eccezione'
                      : 'Salva Eccezione'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
