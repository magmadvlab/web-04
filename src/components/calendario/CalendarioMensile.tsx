'use client';

import { useState, useEffect } from 'react';

interface DisponibilitaGiorno {
  data: string; // YYYY-MM-DD
  disponibile?: boolean;
  posti_totali?: number;
  posti_occupati?: number;
  posti_disponibili?: number;
  stato?: 'disponibile' | 'full' | 'non_disponibile' | string;
}

interface CalendarioMensileProps {
  servizioId: number;
  tipoServizio: 'laboratorio' | 'medico' | 'specialista' | 'professionista' | 'veterinario';
  onSelectDate: (date: string) => void;
  selectedDate?: string;
  fetchDisponibilita: (servizioId: number, mese: string) => Promise<DisponibilitaGiorno[]>;
}

export default function CalendarioMensile({
  servizioId,
  tipoServizio,
  onSelectDate,
  selectedDate,
  fetchDisponibilita,
}: CalendarioMensileProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [disponibilita, setDisponibilita] = useState<DisponibilitaGiorno[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDisponibilita();
  }, [currentMonth, servizioId]);

  const loadDisponibilita = async () => {
    try {
      setLoading(true);
      setError(null);
      const mese = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`;
      const data = await fetchDisponibilita(servizioId, mese);
      setDisponibilita(data);
    } catch (err: any) {
      setError(err.message || 'Errore caricamento disponibilità');
      setDisponibilita([]);
    } finally {
      setLoading(false);
    }
  };

  const changeMonth = (delta: number) => {
    const newMonth = new Date(currentMonth);
    newMonth.setMonth(newMonth.getMonth() + delta);
    setCurrentMonth(newMonth);
  };

  const getDaysInMonth = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay(); // 0 = domenica

    const days: (Date | null)[] = [];

    // Aggiungi giorni vuoti all'inizio (lunedì = 0)
    const startOffset = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;
    for (let i = 0; i < startOffset; i++) {
      days.push(null);
    }

    // Aggiungi tutti i giorni del mese
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }

    return days;
  };

  const getDisponibilitaForDate = (date: Date): DisponibilitaGiorno | null => {
    const dateStr = date.toISOString().split('T')[0];
    return disponibilita.find((d) => d.data === dateStr) || null;
  };

  const isPast = (date: Date): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  };

  const days = getDaysInMonth();
  const weekDays = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

  const normalizeDisponibilita = (disp: DisponibilitaGiorno | null) => {
    if (!disp) {
      return null;
    }

    const postiTotali = Number.isFinite(disp.posti_totali)
      ? (disp.posti_totali as number)
      : 0;
    const postiOccupati = Number.isFinite(disp.posti_occupati)
      ? (disp.posti_occupati as number)
      : 0;
    const postiDisponibili = Number.isFinite(disp.posti_disponibili)
      ? (disp.posti_disponibili as number)
      : Math.max(postiTotali - postiOccupati, 0);

    return {
      ...disp,
      posti_totali: postiTotali,
      posti_occupati: postiOccupati,
      posti_disponibili: postiDisponibili,
      stato: disp.stato ?? '',
      disponibile: disp.disponibile !== false,
    };
  };

  return (
    <div className="bg-white rounded-lg border p-4">
      {/* Header con navigazione mese */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => changeMonth(-1)}
          className="p-2 hover:bg-gray-100 rounded-lg transition"
          aria-label="Mese precedente"
        >
          ←
        </button>
        <h3 className="text-lg font-semibold">
          {currentMonth.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}
        </h3>
        <button
          onClick={() => changeMonth(1)}
          className="p-2 hover:bg-gray-100 rounded-lg transition"
          aria-label="Mese successivo"
        >
          →
        </button>
      </div>

      {/* Giorni della settimana */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {weekDays.map((day) => (
          <div key={day} className="text-center text-sm font-medium text-gray-600 py-2">
            {day}
          </div>
        ))}
      </div>

      {/* Griglia giorni */}
      {loading ? (
        <div className="text-center py-12 text-gray-600">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          Caricamento...
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <p className="text-red-600 mb-2">{error}</p>
          <button
            onClick={loadDisponibilita}
            className="text-blue-600 hover:underline text-sm"
          >
            Riprova
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-1">
          {days.map((date, index) => {
            if (!date) {
              return <div key={`empty-${index}`} className="aspect-square" />;
            }

            const dateStr = date.toISOString().split('T')[0];
            const dispRaw = getDisponibilitaForDate(date);
            const disp = normalizeDisponibilita(dispRaw);
            const past = isPast(date);
            const isSelected = dateStr === selectedDate;

            const isAvailable = !!disp &&
              disp.disponibile &&
              !past &&
              (disp.stato === 'disponibile' || disp.stato === '') &&
              (disp.posti_disponibili ?? 0) > 0;
            const isFull = !!disp &&
              disp.disponibile &&
              !past &&
              (disp.stato === 'full' || (disp.posti_disponibili ?? 0) <= 0);

            let bgColor = 'bg-gray-50';
            let textColor = 'text-gray-400';
            let cursor = 'cursor-not-allowed';
            let hoverClass = '';

            if (past) {
              bgColor = 'bg-gray-100';
              textColor = 'text-gray-400';
            } else if (isAvailable) {
              bgColor = 'bg-green-50';
              textColor = 'text-green-800';
              cursor = 'cursor-pointer';
              hoverClass = 'hover:bg-green-100 hover:ring-2 hover:ring-green-400';
            } else if (isFull) {
              bgColor = 'bg-red-50';
              textColor = 'text-red-800';
            }

            if (isSelected) {
              bgColor = 'bg-blue-600';
              textColor = 'text-white';
            }

            return (
              <button
                key={dateStr}
                onClick={() => isAvailable && onSelectDate(dateStr)}
                disabled={!isAvailable}
                className={`
                  aspect-square p-2 rounded-lg transition-all
                  ${bgColor} ${textColor} ${cursor} ${hoverClass}
                  ${isSelected ? 'ring-2 ring-blue-600' : ''}
                  flex flex-col items-center justify-center
                `}
                title={
                  past
                    ? 'Data passata'
                    : isAvailable
                    ? `${disp.posti_disponibili} posti disponibili`
                    : isFull
                    ? 'Completo'
                    : 'Non disponibile'
                }
              >
                <span className="text-sm font-semibold">{date.getDate()}</span>
                {disp && disp.disponibile && !past && (
                  <span className="text-xs mt-1">
                    {(disp.posti_disponibili ?? 0)}/{(disp.posti_totali ?? 0)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Legenda */}
      <div className="mt-4 pt-4 border-t flex flex-wrap gap-4 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-50 border border-green-200 rounded"></div>
          <span className="text-gray-600">Disponibile</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-red-50 border border-red-200 rounded"></div>
          <span className="text-gray-600">Completo</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-gray-100 border border-gray-200 rounded"></div>
          <span className="text-gray-600">Non disponibile</span>
        </div>
      </div>
    </div>
  );
}
