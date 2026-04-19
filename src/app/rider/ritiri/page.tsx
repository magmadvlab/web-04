'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { classifyOrder, getOrderTypeLabel } from '@/lib/order-classification';

interface PosTerminal {
  id: string;
  label: string;
  provider?: string;
  enabled?: boolean;
}

interface StatoAperturaFarmacia {
  aperta: boolean;
  turnoNotturno: boolean;
  turnoSpecialeAttivo: string | null;
  consegneAttive: boolean;
  descrizione: string;
  fasciaMattina?: { da: string; a: string } | null;
  fasciaPomeriggio?: { da: string; a: string } | null;
}

interface Farmacia {
  id: number;
  nome: string;
  indirizzo: string;
  citta: string;
  cap: string;
  telefono: string;
  latitudine?: number;
  longitudine?: number;
}

interface Ordine {
  id: number;
  codiceOrdine: string;
  stato: string;
  totale?: number;
  numeroArticoli?: number;
  metodoPagamento?: string;
  statoPagamento?: string;
  importoDaIncassare?: number;
  prescrizioneId?: number;
  farmaci?: Array<{ nomeFarmaco?: string; quantita?: number }>;
  farmaciDaBanco?: Array<{ nomeFarmaco?: string; quantita?: number }>;
  paziente: {
    nome: string;
    cognome: string;
    indirizzo: string;
    citta: string;
    telefono: string;
  };
}

interface Notifica {
  id: number;
  farmaciaId: number;
  ordiniPronti: number[];
  totaleOrdini: number;
  statoNotifica: string;
  dataNotifica: string;
  noteRitiro?: string;
  farmacia: Farmacia;
  ordiniDettaglio: Ordine[];
  riepilogoPagamento?: {
    totaleConsegne: number;
    totaleArticoli: number;
    totaleDaPagare: number;
    totaleDaIncassare: number;
  };
  distanzaKm?: number;
  batchAssignment: {
    id: number;
    zonaGeografica: string;
    batchWindow: {
      nome: string;
      dataConsegna: string;
    } | null;
  };
  fallbackStato?: FallbackStatoBatch;
}

interface RitiriData {
  rider: {
    id: number;
    nome: string;
    zoneOperative: string[];
  };
  notifiche: Notifica[];
  totaleNotifiche: number;
  totaleOrdini: number;
}

interface FallbackItem {
  id: number;
  ordineId: number;
  codiceOrdine: string;
  farmaciaOriginale: string;
  farmaciaBackup: string;
  livelloFallback: number;
  stato: string;
}

interface FallbackStatoBatch {
  riepilogo?: {
    totaleOrdiniConFallback: number;
    totaleFallbackProposti: number;
    totaleFallbackAccettati: number;
    totaleFallbackRifiutati: number;
    totaleFallbackCompletati: number;
  };
  fallbacks?: FallbackItem[];
}

interface RiderProfileLike {
  id?: number | string;
  nome?: string;
  cognome?: string;
  zonaOperativa?: string;
  zoneOperative?: string[];
  stato?: string;
}

const BATCH_ENABLED_RIDER_STATI = new Set(['attivo', 'disponibile', 'in_consegna']);

const getApiErrorMessage = (error: unknown): string => {
  if (
    error &&
    typeof error === 'object' &&
    'response' in error &&
    error.response &&
    typeof error.response === 'object' &&
    'data' in error.response &&
    error.response.data &&
    typeof error.response.data === 'object' &&
    'message' in error.response.data &&
    typeof error.response.data.message === 'string'
  ) {
    return error.response.data.message;
  }

  return '';
};

const buildEmptyRitiriData = (profile?: RiderProfileLike): RitiriData => {
  const nomeRider = [profile?.nome, profile?.cognome].filter(Boolean).join(' ').trim();
  const zonaOperativa = profile?.zonaOperativa ? [profile.zonaOperativa] : [];
  const zoneOperative = Array.isArray(profile?.zoneOperative)
    ? profile.zoneOperative
    : zonaOperativa;

  return {
    rider: {
      id: Number(profile?.id || 0),
      nome: nomeRider || 'Rider',
      zoneOperative,
    },
    notifiche: [],
    totaleNotifiche: 0,
    totaleOrdini: 0,
  };
};

export default function RiderRitiriPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<RitiriData | null>(null);
  const [selectedOrdini, setSelectedOrdini] = useState<number[]>([]);
  const [confirmingRitiro, setConfirmingRitiro] = useState(false);
  const [posTerminals, setPosTerminals] = useState<PosTerminal[]>([]);
  const [defaultTerminalByFarmacia, setDefaultTerminalByFarmacia] = useState<Record<string, string>>({});
  const [selectedPosByFarmacia, setSelectedPosByFarmacia] = useState<Record<number, string>>({});
  const [savingPosConfig, setSavingPosConfig] = useState(false);
  const [riderStatus, setRiderStatus] = useState<string>('');
  const [statoAperturaMap, setStatoAperturaMap] = useState<Record<number, StatoAperturaFarmacia>>({});

  // Carica stato apertura per ogni farmacia quando arrivano le notifiche
  const fetchStatoAperturaFarmacie = useCallback(async (notifiche: Notifica[]) => {
    const ids = [...new Set(notifiche.map((n) => n.farmacia.id))];
    const results: Record<number, StatoAperturaFarmacia> = {};
    await Promise.all(
      ids.map(async (id) => {
        try {
          const res = await api.get(`/delivery/batch/ritiri/farmacia/${id}/stato-apertura`);
          results[id] = res.data;
        } catch {
          // Se l'endpoint fallisce, ignora silenziosamente
        }
      }),
    );
    setStatoAperturaMap(results);
  }, []);

  useEffect(() => {
    if (!data?.notifiche || data.notifiche.length === 0) {
      return;
    }

    setSelectedPosByFarmacia((prev) => {
      const next = { ...prev };
      for (const notifica of data.notifiche) {
        if (!next[notifica.farmaciaId]) {
          next[notifica.farmaciaId] =
            defaultTerminalByFarmacia[String(notifica.farmaciaId)]
            || posTerminals.find((terminal) => terminal.enabled !== false)?.id
            || '';
        }
      }
      return next;
    });
  }, [data, defaultTerminalByFarmacia, posTerminals]);

  const loadOrdiniPronti = useCallback(async () => {
    try {
      setLoading(true);

      const profileResponse = await api.get<{ data?: RiderProfileLike }>('/delivery/rider/profile');
      const riderProfile = profileResponse.data?.data || {};
      const normalizedStatus = String(riderProfile?.stato || '').trim().toLowerCase();
      setRiderStatus(normalizedStatus);

      if (normalizedStatus && !BATCH_ENABLED_RIDER_STATI.has(normalizedStatus)) {
        setData(buildEmptyRitiriData(riderProfile));
        return;
      }

      const response = await api.get('/delivery/batch/ritiri/ordini-pronti');
      const payload: RitiriData = response.data;
      const notifiche = payload?.notifiche || [];

      const assignmentIds = Array.from(
        new Set(
          notifiche
            .map((notifica) => Number(notifica.batchAssignment?.id))
            .filter((assignmentId) => Number.isFinite(assignmentId) && assignmentId > 0),
        ),
      );

      const fallbackEntries = await Promise.all(
        assignmentIds.map(async (assignmentId) => {
          try {
            const fallbackResponse = await api.get(
              `/delivery/batch/fallback/assignment/${assignmentId}/stato`,
            );
            return [assignmentId, fallbackResponse.data as FallbackStatoBatch] as const;
          } catch (fallbackError) {
            console.warn(
              `Impossibile caricare fallback per assignment ${assignmentId}`,
              fallbackError,
            );
            return [assignmentId, undefined] as const;
          }
        }),
      );

      const fallbackByAssignment = fallbackEntries.reduce<
        Record<number, FallbackStatoBatch | undefined>
      >((acc, [assignmentId, fallback]) => {
        acc[assignmentId] = fallback;
        return acc;
      }, {});

      const notificheConFallback = notifiche.map((notifica) => {
        const assignmentId = Number(notifica.batchAssignment?.id || 0);
        return {
          ...notifica,
          fallbackStato: fallbackByAssignment[assignmentId],
        };
      });

      setData({
        ...payload,
        notifiche: notificheConFallback,
      });

      // Carica stato apertura per ogni farmacia in background
      void fetchStatoAperturaFarmacie(notificheConFallback);
    } catch (error: unknown) {
      const message = getApiErrorMessage(error).toLowerCase();
      if (message.includes('rider non attivo')) {
        setRiderStatus('non_attivo');
        setData((current) => buildEmptyRitiriData(current?.rider));
        return;
      }

      console.error('Errore caricamento ordini pronti:', error);
      alert('Errore caricamento ordini pronti');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMultiPosConfig = useCallback(async () => {
    try {
      const response = await api.get('/delivery/rider/multipos');

      const payload = response.data?.data || response.data || {};
      const terminals: PosTerminal[] = Array.isArray(payload.terminals) ? payload.terminals : [];
      const defaults = payload.defaultTerminalByFarmacia || {};

      setPosTerminals(terminals);
      setDefaultTerminalByFarmacia(defaults);
    } catch (error: unknown) {
      console.error('Errore caricamento configurazione multiPOS:', error);
    }
  }, []);

  useEffect(() => {
    void Promise.all([loadOrdiniPronti(), loadMultiPosConfig()]);
  }, [loadMultiPosConfig, loadOrdiniPronti]);

  const persistDefaultPosForFarmacia = async (farmaciaId: number, terminalId: string) => {
    try {
      setSavingPosConfig(true);
      const updatedDefaults = {
        ...defaultTerminalByFarmacia,
        [String(farmaciaId)]: terminalId,
      };

      await api.put(
        '/delivery/rider/multipos',
        {
          defaultTerminalByFarmacia: updatedDefaults,
        },
      );

      setDefaultTerminalByFarmacia(updatedDefaults);
    } catch (error: unknown) {
      console.error('Errore salvataggio configurazione multiPOS:', error);
      alert('Impossibile salvare il POS predefinito per questa farmacia');
    } finally {
      setSavingPosConfig(false);
    }
  };

  const handlePosSelectionChange = async (farmaciaId: number, terminalId: string) => {
    setSelectedPosByFarmacia((prev) => ({
      ...prev,
      [farmaciaId]: terminalId,
    }));

    if (terminalId) {
      await persistDefaultPosForFarmacia(farmaciaId, terminalId);
    }
  };

  const getSelectedPosForFarmacia = (farmaciaId: number): PosTerminal | null => {
    const selectedId = selectedPosByFarmacia[farmaciaId]
      || defaultTerminalByFarmacia[String(farmaciaId)]
      || '';
    if (!selectedId) {
      return null;
    }

    return posTerminals.find((terminal) => terminal.id === selectedId) || null;
  };

  const handleMarcaInViaggio = async (notificaId: number) => {
    try {
      await api.post(`/delivery/batch/ritiri/${notificaId}/in-viaggio`, {});

      alert('Stato aggiornato: in viaggio');
      loadOrdiniPronti();
    } catch (error: unknown) {
      console.error('Errore aggiornamento stato:', error);
      alert('Errore aggiornamento stato');
    }
  };

  const handleConfermaRitiro = async (farmaciaId: number, ordiniIds: number[]) => {
    if (ordiniIds.length === 0) {
      alert('Seleziona almeno un ordine');
      return;
    }

    if (!confirm(`Confermare ritiro di ${ordiniIds.length} ordini?`)) {
      return;
    }

    try {
      setConfirmingRitiro(true);
      const selectedPos = getSelectedPosForFarmacia(farmaciaId);
      
      await api.post(
        '/delivery/batch/ritiri/conferma',
        {
          farmaciaId,
          ordiniIds,
          noteRitiro: 'Ritiro confermato da app rider',
          posTerminaleId: selectedPos?.id,
          posLabel: selectedPos?.label,
          providerPos: selectedPos?.provider,
        },
      );

      setSelectedOrdini([]);
      router.push('/delivery/rotte');
    } catch (error: unknown) {
      console.error('Errore conferma ritiro:', error);
      alert('Errore durante conferma ritiro');
    } finally {
      setConfirmingRitiro(false);
    }
  };

  const toggleOrdineSelection = (ordineId: number) => {
    setSelectedOrdini(prev => 
      prev.includes(ordineId)
        ? prev.filter(id => id !== ordineId)
        : [...prev, ordineId]
    );
  };

  const selectAllOrdini = (ordiniIds: number[]) => {
    setSelectedOrdini(ordiniIds);
  };

  const escapeHtml = (value: string) =>
    value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const stampaDistintaRitiro = (notifica: Notifica) => {
    const selectedForFarmacia = selectedOrdini.filter((id) => notifica.ordiniPronti.includes(id));
    const ordiniDaStampare = notifica.ordiniDettaglio.filter((ordine) =>
      selectedForFarmacia.length > 0 ? selectedForFarmacia.includes(ordine.id) : true,
    );

    if (ordiniDaStampare.length === 0) {
      alert('Nessun ordine selezionato per la distinta');
      return;
    }

    const selectedPos = getSelectedPosForFarmacia(notifica.farmaciaId);
    const totaleIncasso = ordiniDaStampare.reduce(
      (sum, ordine) => sum + Number(ordine.importoDaIncassare || 0),
      0,
    );

    const rows = ordiniDaStampare
      .map((ordine, idx) => {
        const codice = ordine.codiceOrdine || `#${ordine.id}`;
        const paziente = `${ordine.paziente?.nome || ''} ${ordine.paziente?.cognome || ''}`.trim();
        const indirizzo = `${ordine.paziente?.indirizzo || ''}, ${ordine.paziente?.citta || ''}`;
        const telefono = ordine.paziente?.telefono || '-';
        const incasso = Number(ordine.importoDaIncassare || 0);

        const tipo = getOrderTypeLabel(classifyOrder(ordine));

        const farmaciList: string[] = [];
        if (Array.isArray(ordine.farmaci)) {
          ordine.farmaci.forEach((f) => {
            farmaciList.push(`${f.nomeFarmaco || 'Farmaco'} x${f.quantita || 1}`);
          });
        }
        if (Array.isArray(ordine.farmaciDaBanco)) {
          ordine.farmaciDaBanco.forEach((f) => {
            farmaciList.push(`${f.nomeFarmaco || 'Farmaco OTC'} x${f.quantita || 1} (OTC)`);
          });
        }
        const farmaciStr = farmaciList.length > 0 ? farmaciList.join(', ') : '-';

        return `
          <tr>
            <td>${idx + 1}</td>
            <td>${escapeHtml(codice)}<br><small>${escapeHtml(tipo)}</small></td>
            <td>${escapeHtml(paziente)}</td>
            <td>${escapeHtml(indirizzo)}</td>
            <td>${escapeHtml(telefono)}</td>
            <td style="font-size:10px">${escapeHtml(farmaciStr)}</td>
            <td>${ordine.numeroArticoli || 0}</td>
            <td>EUR ${incasso.toFixed(2)}</td>
          </tr>
        `;
      })
      .join('');

    const html = `
      <html>
        <head>
          <title>Distinta Ritiro ${escapeHtml(notifica.farmacia.nome)}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
            h1 { margin: 0 0 8px 0; font-size: 22px; }
            .meta { margin-bottom: 16px; font-size: 12px; color: #4b5563; }
            .box { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; margin-bottom: 16px; background: #f9fafb; }
            table { border-collapse: collapse; width: 100%; font-size: 12px; }
            th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; vertical-align: top; }
            th { background: #f3f4f6; }
            .totale { margin-top: 12px; font-weight: 700; font-size: 14px; }
            .note { margin-top: 12px; font-size: 12px; line-height: 1.4; }
            .firme { margin-top: 28px; display: flex; justify-content: space-between; gap: 24px; font-size: 12px; }
            .firma { flex: 1; border-top: 1px solid #9ca3af; padding-top: 6px; text-align: center; min-height: 48px; }
            @media print { body { padding: 8px; } }
          </style>
        </head>
        <body>
          <h1>Distinta Ritiro Delivery</h1>
          <div class="meta">
            Generata da Delivery · ${new Date().toLocaleString('it-IT')}
          </div>
          <div class="box">
            <div><strong>Farmacia:</strong> ${escapeHtml(notifica.farmacia.nome)}</div>
            <div><strong>Indirizzo farmacia:</strong> ${escapeHtml(notifica.farmacia.indirizzo)}, ${escapeHtml(notifica.farmacia.citta)}</div>
            <div><strong>Batch:</strong> ${escapeHtml(notifica.batchAssignment.batchWindow?.nome ?? 'Assegnazione diretta')} · <strong>Zona:</strong> ${escapeHtml(notifica.batchAssignment.zonaGeografica)}</div>
            <div><strong>Consegna pianificata:</strong> ${notifica.batchAssignment.batchWindow ? new Date(notifica.batchAssignment.batchWindow.dataConsegna).toLocaleDateString('it-IT') : 'N/D'}</div>
            <div><strong>POS selezionato:</strong> ${escapeHtml(selectedPos?.label || 'Non selezionato')}</div>
          </div>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Ordine</th>
                <th>Paziente</th>
                <th>Indirizzo Consegna</th>
                <th>Telefono</th>
                <th>Farmaci</th>
                <th>Articoli</th>
                <th>Incasso da Effettuare</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
          <div class="totale">Totale incasso previsto: EUR ${totaleIncasso.toFixed(2)}</div>
          <div class="note">
            <strong>Nota operativa:</strong> il pagamento viene incassato dal rider con POS e trasferito direttamente alla farmacia.
            La distinta accompagna ritiro e consegna per controllo operativo.
          </div>
          <div class="firme">
            <div class="firma">Firma Farmacia (consegna farmaci)</div>
            <div class="firma">Firma Rider (presa in carico)</div>
          </div>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=1200,height=900');
    if (!printWindow) {
      alert('Popup bloccato. Abilita i popup per stampare la distinta.');
      return;
    }

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const getFallbackBadgeClass = (stato: string) => {
    const key = (stato || '').toLowerCase();
    if (key === 'accettato' || key === 'completato') {
      return 'bg-green-100 text-green-800';
    }
    if (key === 'rifiutato' || key === 'annullato') {
      return 'bg-red-100 text-red-800';
    }
    if (key === 'proposto') {
      return 'bg-amber-100 text-amber-800';
    }
    return 'bg-gray-100 text-gray-700';
  };

  const batchDisabledByRiderStatus =
    riderStatus !== '' && !BATCH_ENABLED_RIDER_STATI.has(riderStatus);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Caricamento ordini pronti...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!data || data.notifiche.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <h3 className="mt-4 text-lg font-medium text-gray-900">
              {batchDisabledByRiderStatus ? 'Ritiri batch non disponibili' : 'Nessun ordine pronto'}
            </h3>
            <p className="mt-2 text-gray-500">
              {batchDisabledByRiderStatus
                ? `Il tuo profilo rider e in stato "${riderStatus.replace(/_/g, ' ')}". Attiva il rider per accedere ai ritiri batch.`
                : 'Non ci sono ordini pronti per il ritiro al momento.'}
            </p>
            <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <button
                onClick={loadOrdiniPronti}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Ricarica
              </button>
              <button
                onClick={() => router.push('/delivery/dashboard')}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Torna alla Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Ritiri Ordini Batch</h1>
          <p className="mt-2 text-gray-600">
            Rider: {data.rider.nome} | Zone: {data.rider.zoneOperative.join(', ')}
          </p>
          <div className="mt-4 flex gap-4">
            <div className="bg-white rounded-lg shadow px-4 py-3">
              <p className="text-sm text-gray-600">Farmacie con ordini pronti</p>
              <p className="text-2xl font-bold text-blue-600">{data.totaleNotifiche}</p>
            </div>
            <div className="bg-white rounded-lg shadow px-4 py-3">
              <p className="text-sm text-gray-600">Totale ordini da ritirare</p>
              <p className="text-2xl font-bold text-green-600">{data.totaleOrdini}</p>
            </div>
          </div>
        </div>

        {/* Lista Farmacie */}
        <div className="space-y-4">
          {data.notifiche.map((notifica) => (
            <div
              key={notifica.id}
              className="bg-white rounded-lg shadow-md overflow-hidden"
            >
              {/* Header Farmacia */}
              <div className="bg-blue-50 px-6 py-4 border-b">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {notifica.farmacia.nome}
                      </h3>
                      {/* Badge stato apertura farmacia */}
                      {statoAperturaMap[notifica.farmacia.id] && (
                        <span
                          className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                            statoAperturaMap[notifica.farmacia.id].aperta
                              ? statoAperturaMap[notifica.farmacia.id].turnoNotturno
                                ? 'bg-indigo-100 text-indigo-700'
                                : 'bg-green-100 text-green-700'
                              : statoAperturaMap[notifica.farmacia.id].turnoSpecialeAttivo
                                ? 'bg-red-100 text-red-700'
                                : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {statoAperturaMap[notifica.farmacia.id].aperta ? '🟢' : '🔴'}
                          {' '}
                          {statoAperturaMap[notifica.farmacia.id].descrizione}
                          {!statoAperturaMap[notifica.farmacia.id].consegneAttive &&
                            statoAperturaMap[notifica.farmacia.id].aperta && (
                            <span className="text-amber-600 ml-1">· consegne sospese</span>
                          )}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      {notifica.farmacia.indirizzo}, {notifica.farmacia.citta}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      Tel: {notifica.farmacia.telefono}
                    </p>
                    {/* Fasce orarie della farmacia */}
                    {statoAperturaMap[notifica.farmacia.id] && (
                      <p className="text-xs text-gray-500 mt-1">
                        {statoAperturaMap[notifica.farmacia.id].fasciaMattina && (
                          <span className="mr-3">
                            ☀️ {statoAperturaMap[notifica.farmacia.id].fasciaMattina!.da}–{statoAperturaMap[notifica.farmacia.id].fasciaMattina!.a}
                          </span>
                        )}
                        {statoAperturaMap[notifica.farmacia.id].fasciaPomeriggio && (
                          <span>
                            🌤 {statoAperturaMap[notifica.farmacia.id].fasciaPomeriggio!.da}–{statoAperturaMap[notifica.farmacia.id].fasciaPomeriggio!.a}
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="inline-block px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                      {notifica.totaleOrdini} ordini pronti
                    </span>
                    {notifica.distanzaKm && (
                      <p className="text-sm text-gray-600 mt-2">
                        📍 {notifica.distanzaKm} km
                      </p>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded">
                    {notifica.batchAssignment.zonaGeografica}
                  </span>
                  <span className="text-xs px-2 py-1 bg-purple-100 text-purple-800 rounded">
                    {notifica.batchAssignment.batchWindow?.nome ?? 'Assegnazione diretta'}
                  </span>
                  {(notifica.fallbackStato?.riepilogo?.totaleOrdiniConFallback || 0) > 0 && (
                    <span className="text-xs px-2 py-1 bg-amber-100 text-amber-800 rounded">
                      Fallback attivo: {notifica.fallbackStato?.riepilogo?.totaleOrdiniConFallback || 0}
                    </span>
                  )}
                </div>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-4 gap-2">
                  <div className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded">
                    Totale consegne: {notifica.riepilogoPagamento?.totaleConsegne || notifica.totaleOrdini}
                  </div>
                  <div className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded">
                    Articoli stimati: {notifica.riepilogoPagamento?.totaleArticoli || 0}
                  </div>
                  <div className="text-xs px-2 py-1 bg-amber-100 text-amber-800 rounded">
                    Totale da pagare: €{Number(notifica.riepilogoPagamento?.totaleDaPagare || 0).toFixed(2)}
                  </div>
                  <div className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded">
                    Da incassare: €{Number(notifica.riepilogoPagamento?.totaleDaIncassare || 0).toFixed(2)}
                  </div>
                </div>

                {(notifica.fallbackStato?.riepilogo?.totaleOrdiniConFallback || 0) > 0 && (
                  <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2">
                    <div className="text-xs px-2 py-1 bg-amber-100 text-amber-800 rounded">
                      Proposti: {notifica.fallbackStato?.riepilogo?.totaleFallbackProposti || 0}
                    </div>
                    <div className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded">
                      Accettati: {notifica.fallbackStato?.riepilogo?.totaleFallbackAccettati || 0}
                    </div>
                    <div className="text-xs px-2 py-1 bg-red-100 text-red-800 rounded">
                      Rifiutati: {notifica.fallbackStato?.riepilogo?.totaleFallbackRifiutati || 0}
                    </div>
                    <div className="text-xs px-2 py-1 bg-slate-100 text-slate-700 rounded">
                      Completati: {notifica.fallbackStato?.riepilogo?.totaleFallbackCompletati || 0}
                    </div>
                  </div>
                )}
              </div>

              {/* Lista Ordini */}
              <div className="p-6">
                {(notifica.fallbackStato?.fallbacks || []).length > 0 && (
                  <div className="mb-4 p-3 border border-amber-200 rounded-lg bg-amber-50">
                    <p className="text-sm font-semibold text-amber-900 mb-2">
                      Riassegnazioni Multi-Farmacia (prossimita paziente)
                    </p>
                    <div className="space-y-2">
                      {notifica.fallbackStato?.fallbacks?.slice(0, 4).map((fallback) => (
                        <div
                          key={fallback.id}
                          className="flex flex-wrap items-center justify-between gap-2 text-xs bg-white border border-amber-100 rounded px-2 py-1.5"
                        >
                          <div>
                            <span className="font-medium">{fallback.codiceOrdine}</span>
                            {' '}· {fallback.farmaciaOriginale} → {fallback.farmaciaBackup}
                            {' '}· L{fallback.livelloFallback}
                          </div>
                          <span className={`px-2 py-0.5 rounded ${getFallbackBadgeClass(fallback.stato)}`}>
                            {fallback.stato}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {posTerminals.length > 0 && (
                  <div className="mb-4 p-3 border border-gray-200 rounded-lg bg-gray-50">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      POS per questa farmacia
                    </label>
                    <select
                      value={selectedPosByFarmacia[notifica.farmaciaId] || ''}
                      onChange={(e) => void handlePosSelectionChange(notifica.farmaciaId, e.target.value)}
                      className="w-full md:w-80 border border-gray-300 rounded px-3 py-2 text-sm"
                      disabled={savingPosConfig}
                    >
                      <option value="">Seleziona POS</option>
                      {posTerminals
                        .filter((terminal) => terminal.enabled !== false)
                        .map((terminal) => (
                          <option key={terminal.id} value={terminal.id}>
                            {terminal.label}{terminal.provider ? ` (${terminal.provider})` : ''}
                          </option>
                        ))}
                    </select>
                  </div>
                )}

                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-medium text-gray-900">Ordini da ritirare</h4>
                  <button
                    onClick={() => selectAllOrdini(notifica.ordiniPronti)}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    Seleziona tutti
                  </button>
                </div>

                <div className="space-y-3">
                  {notifica.ordiniDettaglio.map((ordine) => (
                    <div
                      key={ordine.id}
                      className={`border rounded-lg p-4 cursor-pointer transition ${
                        selectedOrdini.includes(ordine.id)
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => toggleOrdineSelection(ordine.id)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={selectedOrdini.includes(ordine.id)}
                            onChange={() => toggleOrdineSelection(ordine.id)}
                            className="mt-1"
                          />
                          <div>
                            <p className="font-medium text-gray-900">
                              Ordine #{ordine.codiceOrdine}
                            </p>
                            <p className="text-sm text-gray-600 mt-1">
                              {ordine.paziente.nome} {ordine.paziente.cognome}
                            </p>
                            <p className="text-sm text-gray-500">
                              {ordine.paziente.indirizzo}, {ordine.paziente.citta}
                            </p>
                            <p className="text-sm text-gray-500">
                              Tel: {ordine.paziente.telefono}
                            </p>
                            <p className="text-sm text-gray-700 mt-1">
                              Totale: €{Number(ordine.totale || 0).toFixed(2)}
                              {' '}| Articoli: {ordine.numeroArticoli || 0}
                              {' '}| Da incassare: €{Number(ordine.importoDaIncassare || 0).toFixed(2)}
                            </p>
                          </div>
                        </div>
                        <span className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded">
                          {ordine.stato}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Azioni */}
                <div className="mt-6 flex gap-3">
                  <button
                    onClick={() => stampaDistintaRitiro(notifica)}
                    className="flex-1 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition"
                  >
                    🖨️ Stampa Distinta
                  </button>
                  <button
                    onClick={() => handleMarcaInViaggio(notifica.id)}
                    className="flex-1 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition"
                  >
                    🚗 In viaggio
                  </button>
                  <button
                    onClick={() => {
                      const selectedForFarmacia = selectedOrdini.filter((id) => notifica.ordiniPronti.includes(id));
                      return handleConfermaRitiro(
                        notifica.farmaciaId,
                        selectedForFarmacia.length > 0 ? selectedForFarmacia : notifica.ordiniPronti,
                      );
                    }}
                    disabled={confirmingRitiro}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50"
                  >
                    {confirmingRitiro ? 'Confermando...' : '✓ Conferma Ritiro'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Refresh Button */}
        <div className="mt-6 text-center">
          <button
            onClick={loadOrdiniPronti}
            className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
          >
            🔄 Ricarica Lista
          </button>
        </div>
      </div>
    </div>
  );
}
