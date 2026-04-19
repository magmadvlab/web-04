'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import api from '@/lib/api';
import { ConfermaConsegnaModal } from '@/components/delivery/ConfermaConsegnaModal';

const RiderRouteMap = dynamic(() => import('@/components/delivery/RiderRouteMap'), {
  ssr: false,
  loading: () => (
    <div className="h-72 w-full rounded-lg bg-gray-100 flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  ),
});

interface PuntoRotta {
  id: number;
  tipo: 'farmacia' | 'consegna';
  indirizzo: string;
  lat: number;
  lng: number;
  ordineId?: number;
  farmaciaId?: number;
  priorita: 'normale' | 'urgente' | 'critico';
  tempo_stimato_minuti: number;
  stato_consegna?: string;
  // Dati paziente (presenti per tipo='consegna')
  pazienteNome?: string;
  pazienteCognome?: string;
  pazienteTelefono?: string;
  importoDaIncassare?: number;
  metodoPagamento?: string;
  codiceOrdine?: string;
}

interface RottaAttiva {
  riderId: number;
  punti: PuntoRotta[];
  distanza_totale_km: number;
  tempo_totale_minuti: number;
  risparmio_km: number;
  risparmio_minuti: number;
  algoritmo_usato: string;
  /** Geometria OSRM encoded polyline per percorso su strade */
  routeGeometry?: string;
  /** Coordinate decodificate percorso stradale [[lat, lng], ...] */
  routeCoordinates?: Array<[number, number]>;
}

export default function RottaRiderPage() {
  const router = useRouter();
  const [rotta, setRotta] = useState<RottaAttiva | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [puntoCorrente, setPuntoCorrente] = useState(0);
  const [consegnaDaConfermare, setConsegnaDaConfermare] = useState<PuntoRotta | null>(null);
  const mapRef = useRef<HTMLDivElement | null>(null);

  const loadOrGenerateRoute = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get('/delivery/rotte/attiva');
      const data: RottaAttiva | null = response.data?.data;

      if (data && data.punti && data.punti.length > 0) {
        setRotta(data);
      } else {
        // Nessuna rotta attiva: genera adesso
        await generateRoute();
      }
    } catch {
      await generateRoute();
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOrGenerateRoute();
  }, [loadOrGenerateRoute]);

  const generateRoute = async () => {
    try {
      setGenerating(true);
      const response = await api.post('/delivery/rotte/ottimizza', { priorita_urgenze: true });
      const data: RottaAttiva = response.data?.data;
      setRotta(data ?? null);
    } catch (error) {
      console.error('Errore generazione rotta:', error);
    } finally {
      setGenerating(false);
    }
  };

  const evidenziaPuntoSuMappa = (idx: number) => {
    setPuntoCorrente(idx);
    mapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const openExternalNavigation = (punto: PuntoRotta) => {
    const hasCoordinates = typeof punto.lat === 'number' && typeof punto.lng === 'number';
    const destinationParam = hasCoordinates
      ? `${punto.lat},${punto.lng}`
      : punto.indirizzo.trim();

    if (!destinationParam || typeof window === 'undefined') {
      alert('Indirizzo o coordinate mancanti per aprire la navigazione.');
      return;
    }

    const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destinationParam)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  /**
   * Apre Google Maps con TUTTI i fermi della rotta già caricati come waypoints.
   * Usa il formato /dir/lat1,lng1/lat2,lng2/... — Google Maps mostra la rotta
   * multi-tappa completa e guida il rider da uno stop al successivo
   * senza dover riaprire la navigazione per ogni consegna.
   * Limite Google Maps: 10 tappe per URL; se ci sono più fermi si usa solo
   * il batch corrente (dal punto attivo in poi, massimo 10).
   */
  const openFullRouteNavigation = () => {
    if (!rotta || rotta.punti.length === 0 || typeof window === 'undefined') return;

    // Parti dal punto corrente, escludi le consegne già completate
    const puntiDaPercorrere = rotta.punti.filter(
      (p, idx) =>
        idx >= puntoCorrente &&
        p.stato_consegna !== 'completata' &&
        typeof p.lat === 'number' &&
        typeof p.lng === 'number',
    );

    if (puntiDaPercorrere.length === 0) {
      alert('Tutti i fermi sono già stati completati o non hanno coordinate.');
      return;
    }

    // Google Maps /dir/ gestisce fino a 10 tappe per URL
    const MAX_TAPPE = 10;
    const puntiLimitati = puntiDaPercorrere.slice(0, MAX_TAPPE);
    const segmenti = puntiLimitati.map((p) => `${p.lat},${p.lng}`).join('/');

    const url = `https://www.google.com/maps/dir/${segmenti}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const sincronizzaConsegnaSuRotta = async (ordineId: number) => {
    try {
      await api.put(`/delivery/rotte/ordini/${ordineId}/stato`, { stato: 'consegnato' });
    } catch (error) {
      console.warn('Errore sincronizzazione rotta:', error);
    }

    let nextIndex = 0;
    setRotta((prev) => {
      if (!prev) return prev;

      const puntiAggiornati = prev.punti.map((punto) =>
        punto.ordineId === ordineId
          ? { ...punto, stato_consegna: 'completata' }
          : punto,
      );

      const indiceConsegnato = puntiAggiornati.findIndex((punto) => punto.ordineId === ordineId);
      const prossimoIndice = puntiAggiornati.findIndex(
        (punto, idx) =>
          idx > indiceConsegnato &&
          punto.tipo === 'consegna' &&
          punto.stato_consegna !== 'completata',
      );

      nextIndex = prossimoIndice !== -1 ? prossimoIndice : Math.max(indiceConsegnato, 0);

      return {
        ...prev,
        punti: puntiAggiornati,
      };
    });
    setPuntoCorrente(nextIndex);
  };

  const handleConfermaConsegnaSuccess = () => {
    const ordineId = consegnaDaConfermare?.ordineId;
    setConsegnaDaConfermare(null);
    if (!ordineId) return;
    void sincronizzaConsegnaSuRotta(ordineId);
  };

  const consegneRimanenti = rotta?.punti.filter(
    (p) => p.tipo === 'consegna' && p.stato_consegna !== 'completata',
  ).length ?? 0;

  const consegneCompletate = rotta?.punti.filter(
    (p) => p.tipo === 'consegna' && p.stato_consegna === 'completata',
  ).length ?? 0;

  if (loading || generating) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
        <p className="text-gray-600">
          {generating ? 'Calcolo rotta ottimizzata...' : 'Caricamento rotta...'}
        </p>
      </div>
    );
  }

  if (!rotta || rotta.punti.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-2xl mx-auto bg-white rounded-lg shadow p-8 text-center">
          <p className="text-gray-500 mb-4">Nessun ordine assegnato al momento.</p>
          <button
            onClick={() => void loadOrGenerateRoute()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Ricarica
          </button>
          <button
            onClick={() => router.push('/delivery/ritiri')}
            className="ml-3 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            Torna ai Ritiri
          </button>
        </div>
      </div>
    );
  }

  // Calcola totaleDaIncassare
  const totaleDaIncassare = rotta.punti
    .filter((p) => p.tipo === 'consegna')
    .reduce((sum, p) => sum + (p.importoDaIncassare ?? 0), 0);
  const puntoAttivo = rotta.punti[puntoCorrente] ?? null;
  const puntoAttivoLabel = puntoAttivo
    ? puntoAttivo.tipo === 'farmacia'
      ? 'Farmacia'
      : [puntoAttivo.pazienteNome, puntoAttivo.pazienteCognome].filter(Boolean).join(' ') || 'Consegna'
    : '';

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-4 flex items-center gap-3">
          <button
            onClick={() => router.push('/delivery/ritiri')}
            className="text-gray-500 hover:text-gray-700"
            title="Torna ai ritiri"
          >
            ← Ritiri
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Rotta Consegne</h1>
            <p className="text-sm text-gray-500">Sequenza ottimizzata · {rotta.algoritmo_usato}</p>
          </div>
        </div>

        {/* Metriche rotta */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <div className="bg-white rounded-lg shadow px-4 py-3 text-center">
            <p className="text-xs text-gray-500">Distanza totale</p>
            <p className="text-xl font-bold text-blue-600">{rotta.distanza_totale_km} km</p>
          </div>
          <div className="bg-white rounded-lg shadow px-4 py-3 text-center">
            <p className="text-xs text-gray-500">Tempo stimato</p>
            <p className="text-xl font-bold text-orange-600">{rotta.tempo_totale_minuti} min</p>
          </div>
          <div className="bg-white rounded-lg shadow px-4 py-3 text-center">
            <p className="text-xs text-gray-500">Consegne rimanenti</p>
            <p className="text-xl font-bold text-green-600">{consegneRimanenti}</p>
          </div>
          <div className="bg-white rounded-lg shadow px-4 py-3 text-center">
            <p className="text-xs text-gray-500">Da incassare</p>
            <p className="text-xl font-bold text-purple-600">€{totaleDaIncassare.toFixed(2)}</p>
          </div>
        </div>

        {/* Progresso */}
        {consegneCompletate > 0 && (
          <div className="mb-4 bg-green-50 border border-green-200 rounded-lg px-4 py-2 text-sm text-green-800">
            ✓ {consegneCompletate} consegn{consegneCompletate === 1 ? 'a' : 'e'} completat{consegneCompletate === 1 ? 'a' : 'e'}
          </div>
        )}

        {/* Mappa rotta interna */}
        <div ref={mapRef} className="mb-5 bg-white rounded-lg shadow overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-900">🗺️ Mappa Rotta</h2>
              <p className="text-xs text-gray-500">
                Tappa {puntoCorrente + 1} / {rotta.punti.length}
                {puntoAttivoLabel ? ` · ${puntoAttivoLabel}` : ''}
              </p>
            </div>
            <div className="flex gap-2">
              {puntoAttivo && (
                <button
                  onClick={() => openExternalNavigation(puntoAttivo)}
                  title="Apri solo questo fermo in Google Maps"
                  className="px-3 py-2 bg-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-300 transition"
                >
                  📍 Questo fermo
                </button>
              )}
              <button
                onClick={openFullRouteNavigation}
                title="Apri l'intera rotta con tutti i fermi già caricati"
                className="px-3 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 transition font-semibold"
              >
                🗺️ Avvia rotta completa
              </button>
            </div>
          </div>
          <div className="p-2">
            <RiderRouteMap
              points={rotta.punti}
              currentPointIndex={puntoCorrente}
              routeCoordinates={rotta.routeCoordinates}
            />
          </div>
        </div>

        {/* Lista punti rotta */}
        <div className="space-y-3">
          {rotta.punti.map((punto, idx) => {
            const isCompletato = punto.stato_consegna === 'completata';
            const isFarmacia = punto.tipo === 'farmacia';
            const pazienteNome = [punto.pazienteNome, punto.pazienteCognome]
              .filter(Boolean)
              .join(' ');

            return (
              <div
                key={`${punto.tipo}-${punto.id}-${idx}`}
                className={`bg-white rounded-lg shadow overflow-hidden border-l-4 ${
                  isCompletato
                    ? 'border-green-400 opacity-60'
                    : isFarmacia
                    ? 'border-blue-500'
                    : punto.priorita === 'urgente'
                    ? 'border-red-500'
                    : 'border-gray-300'
                }`}
              >
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    {/* Numero tappa */}
                    <div
                      className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${
                        isCompletato
                          ? 'bg-green-500'
                          : isFarmacia
                          ? 'bg-blue-500'
                          : 'bg-gray-700'
                      }`}
                    >
                      {isCompletato ? '✓' : idx + 1}
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Tipo tappa */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-xs font-semibold uppercase tracking-wide ${
                            isFarmacia ? 'text-blue-600' : 'text-gray-600'
                          }`}
                        >
                          {isFarmacia ? '🏪 Farmacia (partenza)' : '📦 Consegna'}
                        </span>
                        {punto.priorita === 'urgente' && (
                          <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full">
                            URGENTE
                          </span>
                        )}
                        {isCompletato && (
                          <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">
                            Consegnato
                          </span>
                        )}
                      </div>

                      {/* Nome paziente + codice ordine */}
                      {!isFarmacia && (
                        <p className="font-semibold text-gray-900 mt-0.5">
                          {pazienteNome || 'Paziente'}
                          {punto.codiceOrdine && (
                            <span className="ml-2 text-xs font-normal text-gray-500">
                              #{punto.codiceOrdine}
                            </span>
                          )}
                        </p>
                      )}

                      {/* Indirizzo */}
                      <p className="text-sm text-gray-600 mt-0.5 truncate">{punto.indirizzo}</p>

                      {/* Telefono + importo */}
                      {!isFarmacia && (
                        <div className="flex flex-wrap gap-3 mt-1 text-sm">
                          {punto.pazienteTelefono && (
                            <a
                              href={`tel:${punto.pazienteTelefono}`}
                              className="text-blue-600 hover:underline"
                            >
                              📞 {punto.pazienteTelefono}
                            </a>
                          )}
                          {(punto.importoDaIncassare ?? 0) > 0 && (
                            <span className="text-purple-700 font-semibold">
                              💶 €{(punto.importoDaIncassare ?? 0).toFixed(2)} da incassare
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Azioni */}
                  <div
                    className={`mt-3 grid gap-2 ${
                      !isFarmacia && !isCompletato ? 'sm:grid-cols-3' : 'sm:grid-cols-2'
                    }`}
                  >
                    <button
                      onClick={() => openExternalNavigation(punto)}
                      title="Naviga solo a questo fermo"
                      className="px-3 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 transition"
                    >
                      📍 Solo questo fermo
                    </button>
                    <button
                      onClick={() => evidenziaPuntoSuMappa(idx)}
                      className="px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition"
                    >
                      📍 Mostra sulla mappa
                    </button>
                    {!isFarmacia && !isCompletato && (
                      <button
                        onClick={() => punto.ordineId && setConsegnaDaConfermare(punto)}
                        className="px-3 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition"
                      >
                        📸 Prova consegna
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer azioni */}
        <div className="mt-6 flex gap-3">
          <button
            onClick={() => void generateRoute()}
            disabled={generating}
            className="flex-1 px-4 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-800 transition disabled:opacity-50"
          >
            {generating ? 'Ricalcolo...' : '🔄 Ricalcola Rotta'}
          </button>
          <button
            onClick={() => router.push('/delivery/ritiri')}
            className="px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
          >
            ← Ritiri
          </button>
        </div>

        {/* Risparmio */}
        {rotta.risparmio_km > 0 && (
          <p className="mt-3 text-center text-xs text-gray-400">
            Algoritmo ha risparmiato ~{rotta.risparmio_km} km e ~{rotta.risparmio_minuti} min
            rispetto alla rotta non ottimizzata
          </p>
        )}
      </div>

      <ConfermaConsegnaModal
        open={consegnaDaConfermare !== null}
        ordineId={consegnaDaConfermare?.ordineId ?? 0}
        onClose={() => setConsegnaDaConfermare(null)}
        onSuccess={handleConfermaConsegnaSuccess}
      />
    </div>
  );
}
