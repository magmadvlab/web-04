import { useState, useEffect, useCallback } from 'react';

interface ConsensoState {
  haConsenso: boolean;
  primaVolta: boolean;
  loading: boolean;
}

interface PreferenzeConsenso {
  analizzaReferti: boolean;
  analizzaPrescrizioni: boolean;
  analizzaEsami: boolean;
  riceviSuggerimentiSpecialisti: boolean;
  riceviNotificheUrgenza: boolean;
  conservaAnalisi: boolean;
  condividiDatiAnonimi: boolean;
}

/**
 * Hook per gestire il consenso orientamento
 * 
 * Uso:
 * ```tsx
 * const { 
 *   consenso, 
 *   mostraModal, 
 *   mostraBanner,
 *   handleAccettaConsenso,
 *   handleRifiutaConsenso,
 *   handleAnalizzaDocumento
 * } = useOrientamentoConsenso();
 * 
 * // Dopo upload documento
 * if (mostraModal) {
 *   <ConsensoModal onAccetta={handleAccettaConsenso} />
 * }
 * ```
 */
export function useOrientamentoConsenso() {
  const [consenso, setConsenso] = useState<ConsensoState>({
    haConsenso: false,
    primaVolta: false,
    loading: true
  });

  const [mostraModal, setMostraModal] = useState(false);
  const [mostraBanner, setMostraBanner] = useState(false);
  const [ultimoDocumentoId, setUltimoDocumentoId] = useState<number | null>(null);

  // Verifica consenso all'avvio
  useEffect(() => {
    verificaConsenso();
  }, []);

  const verificaConsenso = async () => {
    try {
      const res = await fetch('/api/paziente/orientamento/consenso', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await res.json();
      
      setConsenso({
        haConsenso: data.haConsenso,
        primaVolta: data.primaVolta,
        loading: false
      });
    } catch (error) {
      console.error('Errore verifica consenso:', error);
      setConsenso(prev => ({ ...prev, loading: false }));
    }
  };

  /**
   * Chiamare dopo upload documento
   */
  const handleDocumentoCaricato = useCallback((documentoId: number, tipo: 'referto' | 'prescrizione' | 'esame' = 'referto') => {
    setUltimoDocumentoId(documentoId);

    // Check preferenza localStorage
    const analisiAutomatica = localStorage.getItem('orientamento_analisi_automatica');
    const nonChiedere = localStorage.getItem('orientamento_non_chiedere');

    if (analisiAutomatica === 'true') {
      // Analisi automatica senza chiedere
      triggeraAnalisi(documentoId, tipo);
      return;
    }

    if (nonChiedere === 'true') {
      // Non chiedere più
      return;
    }

    // Mostra modal o banner
    if (consenso.primaVolta) {
      setMostraModal(true);
    } else if (consenso.haConsenso) {
      // Ha già consenso, analisi automatica
      triggeraAnalisi(documentoId, tipo);
    } else {
      // Consenso negato in passato, mostra banner
      setMostraBanner(true);
    }
  }, [consenso]);

  /**
   * Accetta consenso
   */
  const handleAccettaConsenso = async (preferenze: PreferenzeConsenso) => {
    try {
      await fetch('/api/paziente/orientamento/consenso', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          consenso: true,
          preferenze
        })
      });

      setConsenso(prev => ({ ...prev, haConsenso: true, primaVolta: false }));
      setMostraModal(false);

      // Triggera analisi del documento appena caricato
      if (ultimoDocumentoId) {
        triggeraAnalisi(ultimoDocumentoId, 'referto');
      }
    } catch (error) {
      console.error('Errore salvataggio consenso:', error);
    }
  };

  /**
   * Rifiuta consenso
   */
  const handleRifiutaConsenso = async () => {
    try {
      await fetch('/api/paziente/orientamento/consenso', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          consenso: false
        })
      });

      setConsenso(prev => ({ ...prev, haConsenso: false, primaVolta: false }));
      setMostraModal(false);
    } catch (error) {
      console.error('Errore rifiuto consenso:', error);
    }
  };

  /**
   * Analizza documento specifico
   */
  const handleAnalizzaDocumento = async (documentoId: number, tipo: 'referto' | 'prescrizione' | 'esame' = 'referto') => {
    setMostraBanner(false);
    await triggeraAnalisi(documentoId, tipo);
  };

  /**
   * Triggera analisi documento
   */
  const triggeraAnalisi = async (documentoId: number, tipo: string) => {
    try {
      const res = await fetch(`/api/paziente/orientamento/analizza/${documentoId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ tipo })
      });

      const data = await res.json();

      if (data.success) {
        // Mostra toast successo
        console.log('Analisi in corso...', data.messaggio);
        // TODO: Mostrare toast UI
      } else if (data.richiestaConsenso) {
        // Serve consenso
        setMostraModal(true);
      }
    } catch (error) {
      console.error('Errore triggera analisi:', error);
    }
  };

  return {
    consenso,
    mostraModal,
    setMostraModal,
    mostraBanner,
    setMostraBanner,
    handleDocumentoCaricato,
    handleAccettaConsenso,
    handleRifiutaConsenso,
    handleAnalizzaDocumento
  };
}
