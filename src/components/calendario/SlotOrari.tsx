'use client';

import { useState, useEffect } from 'react';

interface TimeSlot {
  ora_inizio: string; // HH:mm
  ora_fine: string; // HH:mm
  disponibile: boolean;
  posti_disponibili?: number;
  max_prenotazioni?: number;
  tipo?: 'normale' | 'pausa' | 'chiusura';
  motivo?: string;
}

interface SlotOrariProps {
  servizioId: number;
  tipoServizio: 'laboratorio' | 'medico' | 'specialista' | 'professionista' | 'veterinario';
  selectedDate: string; // YYYY-MM-DD
  onSelectSlot: (slot: TimeSlot) => void;
  onBack: () => void;
  selectedSlot?: TimeSlot;
  fetchSlots: (servizioId: number, data: string) => Promise<TimeSlot[]>;
}

export default function SlotOrari({
  servizioId,
  tipoServizio,
  selectedDate,
  onSelectSlot,
  onBack,
  selectedSlot,
  fetchSlots,
}: SlotOrariProps) {
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSlots();
  }, [servizioId, selectedDate]);

  const loadSlots = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchSlots(servizioId, selectedDate);
      setSlots(data);
    } catch (err: any) {
      setError(err.message || 'Errore caricamento slot');
      setSlots([]);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('it-IT', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const renderSlot = (slot: TimeSlot, index: number) => {
    const isSelected =
      selectedSlot?.ora_inizio === slot.ora_inizio &&
      selectedSlot?.ora_fine === slot.ora_fine;
    const isFull = slot.disponibile && (slot.posti_disponibili === 0);
    const isPausa = slot.tipo === 'pausa' || slot.tipo === 'chiusura';

    if (isPausa) {
      return (
        <div
          key={index}
          className="bg-gray-200 text-gray-600 p-3 rounded-lg text-center border border-gray-300"
        >
          <div className="text-sm font-medium">{slot.ora_inizio}</div>
          <div className="text-xs mt-1">
            {slot.tipo === 'pausa' ? '🍽️ Pausa' : '🔒 Chiuso'}
          </div>
          {slot.motivo && <div className="text-xs mt-1">{slot.motivo}</div>}
        </div>
      );
    }

    let bgColor = 'bg-gray-100';
    let textColor = 'text-gray-400';
    let borderColor = 'border-gray-200';
    let cursor = 'cursor-not-allowed';
    let hoverClass = '';

    if (isSelected) {
      bgColor = 'bg-blue-600';
      textColor = 'text-white';
      borderColor = 'border-blue-600';
    } else if (isFull) {
      bgColor = 'bg-gray-100';
      textColor = 'text-gray-400';
      borderColor = 'border-gray-200';
    } else if (slot.disponibile) {
      bgColor = 'bg-green-50';
      textColor = 'text-green-800';
      borderColor = 'border-green-200';
      cursor = 'cursor-pointer';
      hoverClass = 'hover:bg-green-100 hover:border-green-400';
    }

    return (
      <button
        key={index}
        onClick={() => !isFull && slot.disponibile && onSelectSlot(slot)}
        disabled={isFull || !slot.disponibile}
        className={`
          p-3 rounded-lg border-2 transition-all
          ${bgColor} ${textColor} ${borderColor} ${cursor} ${hoverClass}
        `}
      >
        <div className="font-semibold text-sm">{slot.ora_inizio}</div>
        <div className="text-xs mt-1">
          {isFull ? (
            <span className="text-red-600">✗ Completo</span>
          ) : slot.disponibile ? (
            <span className="text-green-600">
              ✓ {slot.posti_disponibili || 0}
              {slot.max_prenotazioni ? `/${slot.max_prenotazioni}` : ''} posto/i
            </span>
          ) : (
            <span>Non disponibile</span>
          )}
        </div>
      </button>
    );
  };

  return (
    <div className="bg-white rounded-lg border p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={onBack}
          className="text-blue-600 hover:underline flex items-center gap-2"
        >
          ← Torna al calendario
        </button>
        <h3 className="text-lg font-semibold">{formatDate(selectedDate)}</h3>
        <div className="w-32"></div> {/* Spacer per centrare il titolo */}
      </div>

      {/* Loading / Error / Slots */}
      {loading ? (
        <div className="text-center py-12 text-gray-600">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          Caricamento slot...
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <p className="text-red-600 mb-2">{error}</p>
          <button
            onClick={loadSlots}
            className="text-blue-600 hover:underline text-sm"
          >
            Riprova
          </button>
        </div>
      ) : slots.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🔒</div>
          <p className="text-gray-600 mb-2">Nessuno slot disponibile per questa data</p>
          <p className="text-sm text-gray-500">Prova a selezionare un'altra data</p>
        </div>
      ) : (
        <>
          {/* Griglia Slot - Responsive: 4 colonne desktop, 2 mobile */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-6">
            {slots.map((slot, index) => renderSlot(slot, index))}
          </div>

          {/* Legenda */}
          <div className="pt-4 border-t flex flex-wrap gap-4 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-50 border-2 border-green-200 rounded"></div>
              <span className="text-gray-600">Disponibile</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-gray-100 border-2 border-gray-200 rounded"></div>
              <span className="text-gray-600">Completo</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-gray-200 border-2 border-gray-300 rounded"></div>
              <span className="text-gray-600">Pausa/Chiuso</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-blue-600 border-2 border-blue-600 rounded"></div>
              <span className="text-gray-600">Selezionato</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
