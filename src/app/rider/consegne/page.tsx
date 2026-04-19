'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, MapPin, Phone, CreditCard, CheckCircle, XCircle, Euro } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ConsegnaConPOS {
  id: number;
  ordineId: number;
  paziente: {
    id: number;
    nome: string;
    cognome: string;
    telefono: string;
  };
  indirizzo: string;
  latitudine: number;
  longitudine: number;
  importoTotale: number;
  farmacia: {
    id: number;
    nome: string;
    pos: {
      id: number;
      codiceTerminale: string;
      nomeTerminale: string;
      provider: string;
    };
  };
  paymentId: number;
  statoPagamento: string;
}

export default function ConsegneRiderPage() {
  const [consegne, setConsegne] = useState<ConsegnaConPOS[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingOrderId, setProcessingOrderId] = useState<number | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchConsegne();
  }, []);

  const fetchConsegne = async () => {
    try {
      const response = await fetch('/api/delivery/rider/consegne', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) throw new Error('Errore nel caricamento consegne');

      const data = await response.json();
      setConsegne(data);
    } catch (error) {
      toast({
        title: 'Errore',
        description: 'Impossibile caricare le consegne',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const ensurePaymentId = async (ordineId: number, currentPaymentId: number) => {
    if (currentPaymentId > 0) {
      return currentPaymentId;
    }

    const response = await fetch(`/api/delivery/rider/consegne/${ordineId}/crea-pagamento`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
    });

    if (!response.ok) {
      throw new Error('Errore nella creazione del record pagamento');
    }

    const data = await response.json();
    const createdPaymentId = Number(data?.id || data?.paymentId || 0);

    if (!createdPaymentId) {
      throw new Error('Record pagamento non valido');
    }

    setConsegne((prev) =>
      prev.map((consegna) =>
        consegna.ordineId === ordineId
          ? {
              ...consegna,
              paymentId: createdPaymentId,
              statoPagamento: data?.stato_pagamento || data?.statoPagamento || consegna.statoPagamento,
            }
          : consegna
      )
    );

    return createdPaymentId;
  };

  const confermaPagamento = async (currentPaymentId: number, ordineId: number) => {
    setProcessingOrderId(ordineId);

    try {
      const paymentId = await ensurePaymentId(ordineId, currentPaymentId);
      const response = await fetch(`/api/delivery/rider/pagamenti/${paymentId}/conferma`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          metodoPagamento: 'pos',
          riferimentoTransazione: `TRX-${Date.now()}`,
        }),
      });

      if (!response.ok) throw new Error('Errore nella conferma pagamento');

      toast({
        title: 'Pagamento Confermato',
        description: `Ordine #${ordineId} consegnato con successo`,
      });

      // Ricarica consegne
      await fetchConsegne();
    } catch (error) {
      toast({
        title: 'Errore',
        description: 'Impossibile confermare il pagamento',
        variant: 'destructive',
      });
    } finally {
      setProcessingOrderId(null);
    }
  };

  const segnaPagamentoFallito = async (currentPaymentId: number, ordineId: number) => {
    const motivo = prompt('Motivo del fallimento:');
    if (!motivo) return;

    setProcessingOrderId(ordineId);

    try {
      const paymentId = await ensurePaymentId(ordineId, currentPaymentId);
      const response = await fetch(`/api/delivery/rider/pagamenti/${paymentId}/fallito`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ motivo }),
      });

      if (!response.ok) throw new Error('Errore nella segnalazione');

      toast({
        title: 'Pagamento Fallito',
        description: `Ordine #${ordineId} segnalato come fallito`,
        variant: 'destructive',
      });

      // Ricarica consegne
      await fetchConsegne();
    } catch (error) {
      toast({
        title: 'Errore',
        description: 'Impossibile segnalare il fallimento',
        variant: 'destructive',
      });
    } finally {
      setProcessingOrderId(null);
    }
  };

  const getStatoBadge = (stato: string) => {
    switch (stato) {
      case 'da_riscuotere':
        return <Badge variant="outline">Da Riscuotere</Badge>;
      case 'pagato':
        return <Badge className="bg-green-500">Pagato</Badge>;
      case 'fallito':
        return <Badge variant="destructive">Fallito</Badge>;
      default:
        return <Badge>{stato}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Le Mie Consegne</h1>
        <p className="text-muted-foreground">
          Consegne da effettuare con pagamento POS
        </p>
      </div>

      {consegne.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Nessuna consegna in programma
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {consegne.map((consegna) => (
            <Card key={consegna.ordineId} className="overflow-hidden">
              <CardHeader className="bg-muted/50">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">
                    Consegna #{consegna.ordineId}
                  </CardTitle>
                  {getStatoBadge(consegna.statoPagamento)}
                </div>
              </CardHeader>

              <CardContent className="pt-6 space-y-4">
                {/* Info Paziente */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">👤 Paziente:</span>
                    <span>
                      {consegna.paziente.nome} {consegna.paziente.cognome}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    <span>{consegna.indirizzo}</span>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="h-4 w-4" />
                    <a
                      href={`tel:${consegna.paziente.telefono}`}
                      className="hover:underline"
                    >
                      {consegna.paziente.telefono}
                    </a>
                  </div>
                </div>

                <div className="border-t pt-4" />

                {/* Importo da Riscuotere */}
                <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Euro className="h-5 w-5 text-blue-600" />
                      <span className="font-semibold">TOTALE DA RISCUOTERE</span>
                    </div>
                    <span className="text-2xl font-bold text-blue-600">
                      €{Number(consegna.importoTotale || 0).toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Info POS */}
                <div className="bg-purple-50 dark:bg-purple-950 p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <CreditCard className="h-5 w-5 text-purple-600" />
                    <span className="font-semibold">USA QUESTO POS:</span>
                  </div>
                  <div className="ml-7 space-y-1">
                    <div className="text-lg font-bold text-purple-600">
                      {consegna.farmacia.pos.nomeTerminale} ({consegna.farmacia.pos.codiceTerminale})
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {consegna.farmacia.nome}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Provider: {consegna.farmacia.pos.provider}
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4" />

                {/* Azioni */}
                {consegna.statoPagamento === 'da_riscuotere' && (
                  <div className="flex gap-3">
                    <Button
                      onClick={() => confermaPagamento(consegna.paymentId, consegna.ordineId)}
                      disabled={processingOrderId === consegna.ordineId}
                      className="flex-1 bg-green-600 hover:bg-green-700"
                    >
                      {processingOrderId === consegna.ordineId ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <CheckCircle className="h-4 w-4 mr-2" />
                      )}
                      Pagamento Ricevuto
                    </Button>

                    <Button
                      onClick={() => segnaPagamentoFallito(consegna.paymentId, consegna.ordineId)}
                      disabled={processingOrderId === consegna.ordineId}
                      variant="destructive"
                      className="flex-1"
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Pagamento Fallito
                    </Button>
                  </div>
                )}

                {consegna.statoPagamento === 'pagato' && (
                  <div className="text-center text-green-600 font-semibold">
                    ✓ Consegna completata
                  </div>
                )}

                {consegna.statoPagamento === 'fallito' && (
                  <div className="text-center text-red-600 font-semibold">
                    ✗ Pagamento fallito
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
