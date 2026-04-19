"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loading } from "@/components/shared/Loading";
import { NotFound } from "@/components/shared/NotFound";
import { useToast } from "@/hooks/use-toast";
import { classifyOrder, getOrderTypeLabel } from "@/lib/order-classification";
import type { ApiResponse, Ordine } from "@/types/api";
import {
  ArrowLeft,
  Package,
  MapPin,
  Euro,
  CheckCircle2,
  Clock,
  User,
  Phone,
  Mail,
  Navigation,
  PlayCircle,
  CreditCard,
  FileText,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { ConfermaConsegnaModal } from "@/components/delivery/ConfermaConsegnaModal";

interface PosTerminal {
  id: string;
  label: string;
  provider?: string;
  enabled?: boolean;
}

interface RiderMultiPosConfig {
  terminals: PosTerminal[];
  defaultTerminalByFarmacia: Record<string, string>;
}

export default function DeliveryDettaglioOrdinePage() {
  const params = useParams();
  const ordineId = parseInt(params.id as string);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [incassoImporto, setIncassoImporto] = useState("");
  const [incassoPosId, setIncassoPosId] = useState("");
  const [incassoRiferimento, setIncassoRiferimento] = useState("");
  const [incassoNote, setIncassoNote] = useState("");
  const [showConfermaModal, setShowConfermaModal] = useState(false);

  const { data: ordine, isLoading, error } = useQuery<Ordine>({
    queryKey: ["delivery-ordine", ordineId],
    queryFn: async () => {
      const response = await api.get<ApiResponse<Ordine>>(`/delivery/rider/ordini/${ordineId}`);
      return response.data.data;
    },
    enabled: Number.isFinite(ordineId),
  });

  const { data: multiPosConfig } = useQuery<RiderMultiPosConfig>({
    queryKey: ["delivery-rider-multipos"],
    queryFn: async () => {
      const response = await api.get("/delivery/rider/multipos");
      return response.data.data || response.data;
    },
  });

  const marcaInConsegnaMutation = useMutation({
    mutationFn: async () => {
      await api.put(`/delivery/ordini/${ordineId}/in-consegna`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["delivery-rider-ordini"] });
      queryClient.invalidateQueries({ queryKey: ["delivery-ordine", ordineId] });
      toast({
        title: "Ordine aggiornato",
        description: "L'ordine è stato marcato come in consegna",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error?.response?.data?.error || "Errore durante l'aggiornamento",
        variant: "destructive",
      });
    },
  });

  const marcaConsegnatoMutation = useMutation({
    mutationFn: async () => {
      await api.put(`/delivery/ordini/${ordineId}/consegnato`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["delivery-rider-ordini"] });
      queryClient.invalidateQueries({ queryKey: ["delivery-ordine", ordineId] });
      toast({
        title: "Ordine consegnato",
        description: "L'ordine è stato marcato come consegnato con successo",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error?.response?.data?.error || "Errore durante l'aggiornamento",
        variant: "destructive",
      });
    },
  });

  const registraIncassoMutation = useMutation({
    mutationFn: async () => {
      if (!ordine) {
        return;
      }

      const selectedPos = multiPosConfig?.terminals?.find((terminal) => terminal.id === incassoPosId);
      const importoIncassato = Number(incassoImporto || 0);
      await api.post(`/delivery/ordini/${ordineId}/incasso-contrassegno`, {
        importoIncassato,
        posTerminaleId: selectedPos?.id || undefined,
        posLabel: selectedPos?.label || undefined,
        providerPos: selectedPos?.provider || undefined,
        riferimentoOperazionePos: incassoRiferimento || undefined,
        noteIncasso: incassoNote || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["delivery-rider-ordini"] });
      toast({
        title: "Incasso registrato",
        description: "Pagamento contrassegno registrato correttamente",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Errore incasso",
        description: error?.response?.data?.message || error?.response?.data?.error || "Errore durante registrazione incasso",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (!ordine) {
      return;
    }

    const totale = Number((ordine as any).totale || ordine.importoTotale || 0);
    if (!incassoImporto) {
      setIncassoImporto(totale.toFixed(2));
    }

    if (!incassoPosId && ordine.farmaciaId && multiPosConfig?.terminals?.length) {
      const preferredPos =
        multiPosConfig.defaultTerminalByFarmacia?.[String(ordine.farmaciaId)]
        || multiPosConfig.terminals.find((terminal) => terminal.enabled !== false)?.id
        || "";

      if (preferredPos) {
        setIncassoPosId(preferredPos);
      }
    }
  }, [ordine, multiPosConfig, incassoImporto, incassoPosId]);

  if (isLoading) {
    return <Loading />;
  }

  if (error || !ordine) {
    return <NotFound message="Ordine non trovato" />;
  }

  const tipoOrdine = classifyOrder(ordine);

  const formatDateTime = (value?: string | null) => {
    if (!value) {
      return "n/d";
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "n/d";
    }

    return date.toLocaleString("it-IT", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDate = (value?: string | null) => {
    if (!value) {
      return null;
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return null;
    }

    return date.toLocaleDateString("it-IT");
  };

  const openNavigation = (destination: {
    indirizzo?: string | null;
    citta?: string | null;
    cap?: string | null;
    provincia?: string | null;
    latitudine?: number | null;
    longitudine?: number | null;
  }) => {
    const hasCoordinates =
      typeof destination.latitudine === "number" &&
      typeof destination.longitudine === "number";

    const addressParts = [
      destination.indirizzo,
      destination.cap,
      destination.citta,
      destination.provincia,
    ].filter(Boolean);

    const destinationParam = hasCoordinates
      ? `${destination.latitudine},${destination.longitudine}`
      : addressParts.join(", ");

    if (!destinationParam || typeof window === "undefined") {
      toast({
        title: "Navigazione non disponibile",
        description: "Indirizzo o coordinate mancanti per aprire la mappa.",
        variant: "destructive",
      });
      return;
    }

    const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destinationParam)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const getStatusColor = (stato: string) => {
    switch (stato.toLowerCase()) {
      case "consegnato":
        return "bg-green-100 text-green-800 border-green-200";
      case "in_consegna":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "pronto":
      case "pronto_ritiro":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "assegnato":
      case "assegnato_rider":
        return "bg-purple-100 text-purple-800 border-purple-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getStatusLabel = (stato: string) => {
    const labels: Record<string, string> = {
      creato: "Creato",
      in_preparazione: "In Preparazione",
      pronto: "Pronto",
      pronto_ritiro: "Pronto per ritiro",
      assegnato: "Assegnato",
      assegnato_rider: "Assegnato al Rider",
      in_consegna: "In Consegna",
      consegnato: "Consegnato",
    };
    return labels[stato.toLowerCase()] || stato;
  };

  const farmaci = Array.isArray(ordine.farmaci) ? ordine.farmaci : [];
  const metodoPagamento = String((ordine as any).metodoPagamento || "").toLowerCase();
  const statoPagamento = String((ordine as any).statoPagamento || "").toLowerCase();
  const pagamentoContrassegno = metodoPagamento === "contrassegno" || statoPagamento === "collecting";
  const incassoRegistrato = statoPagamento === "paid";
  const canMarkInConsegna =
    ordine.stato.toLowerCase() === "assegnato_rider" ||
    ordine.stato.toLowerCase() === "pronto" ||
    ordine.stato.toLowerCase() === "pronto_ritiro";
  const canMarkConsegnato = ordine.stato.toLowerCase() === "in_consegna" && (!pagamentoContrassegno || incassoRegistrato);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/delivery/ordini">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Torna agli ordini
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Dettaglio Ordine</h1>
            <p className="text-gray-600 mt-1">
              Codice: {(ordine as any).codiceOrdine || `#${ordine.id}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${
              tipoOrdine === "misto"
                ? 'bg-violet-100 text-violet-800'
                : tipoOrdine === "prescrizione"
                  ? 'bg-sky-100 text-sky-800'
                  : 'bg-emerald-100 text-emerald-800'
            }`}>
              {getOrderTypeLabel(tipoOrdine)}
            </span>
            <span className={`rounded-full px-4 py-2 text-sm font-medium border ${getStatusColor(ordine.stato)}`}>
              {getStatusLabel(ordine.stato)}
            </span>
          </div>
          {canMarkInConsegna && (
            <Button
              onClick={() => marcaInConsegnaMutation.mutate()}
              disabled={marcaInConsegnaMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <PlayCircle className="h-4 w-4 mr-2" />
              Marca in Consegna
            </Button>
          )}
          {canMarkConsegnato && (
            <Button
              onClick={() => setShowConfermaModal(true)}
              disabled={marcaConsegnatoMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Marca Consegnato
            </Button>
          )}
          {ordine.stato.toLowerCase() === "in_consegna" && pagamentoContrassegno && !incassoRegistrato && (
            <span className="text-sm text-amber-700 bg-amber-100 px-3 py-2 rounded border border-amber-200">
              Registra incasso prima di chiudere la consegna
            </span>
          )}
        </div>
      </div>

      {/* Banner stato consegnato */}
      {ordine.stato.toLowerCase() === "consegnato" && (
        <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-5 py-4">
          <ShieldCheck className="h-6 w-6 text-green-600 shrink-0" />
          <div>
            <p className="font-semibold text-green-800">Ordine consegnato con successo</p>
            {(ordine as any).dataConsegna && (
              <p className="text-sm text-green-700 mt-0.5">
                {formatDateTime((ordine as any).dataConsegna)}
              </p>
            )}
          </div>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        {/* Colonna principale */}
        <div className="md:col-span-2 space-y-6">
          {/* Informazioni Ritiro Farmacia */}
          {ordine.farmacia && (
            <Card className="border-blue-200 bg-blue-50/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-blue-600" />
                  Ritiro da Farmacia
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="font-medium text-lg">{ordine.farmacia.nome}</p>
                  <div className="flex items-start gap-2 mt-2">
                    <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-sm">{ordine.farmacia.indirizzo}</p>
                      <p className="text-sm text-gray-600">
                        {[ordine.farmacia.cap, ordine.farmacia.citta].filter(Boolean).join(" ")}
                        {ordine.farmacia.provincia ? ` (${ordine.farmacia.provincia})` : ""}
                      </p>
                    </div>
                  </div>
                </div>
                {ordine.farmacia.telefono && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-gray-400" />
                    <span className="text-sm">{ordine.farmacia.telefono}</span>
                  </div>
                )}
                {ordine.farmacia.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-gray-400" />
                    <span className="text-sm">{ordine.farmacia.email}</span>
                  </div>
                )}
                <div className="pt-2 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => ordine.farmacia && openNavigation(ordine.farmacia)}
                  >
                    <Navigation className="h-4 w-4 mr-2" />
                    Apri Navigazione
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Informazioni Consegna Paziente */}
          {ordine.paziente && (
            <Card className="border-green-200 bg-green-50/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5 text-green-600" />
                  Consegna a Paziente
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="font-medium text-lg">
                    {ordine.paziente.nome} {ordine.paziente.cognome}
                  </p>
                </div>
                {(ordine as any).indirizzoConsegna && (
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">{ordine.indirizzoConsegna}</p>
                      {ordine.paziente.cap && ordine.paziente.citta && (
                        <p className="text-sm text-gray-600">
                          {ordine.paziente.cap} {ordine.paziente.citta} ({ordine.paziente.provincia})
                        </p>
                      )}
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  {ordine.paziente.telefono && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-gray-400" />
                      <a href={`tel:${ordine.paziente.telefono}`} className="text-sm text-blue-600 hover:underline">
                        {ordine.paziente.telefono}
                      </a>
                    </div>
                  )}
                  {ordine.paziente.emailPersonale && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-gray-400" />
                      <a href={`mailto:${ordine.paziente.emailPersonale}`} className="text-sm text-blue-600 hover:underline">
                        {ordine.paziente.emailPersonale}
                      </a>
                    </div>
                  )}
                </div>
                {(ordine as any).finestraOraria && (
                  <div className="pt-2 border-t">
                    <p className="text-sm font-medium text-gray-600">Finestra Oraria</p>
                    <p className="text-sm mt-1">{(ordine as any).finestraOraria}</p>
                  </div>
                )}
                {(ordine as any).noteConsegna && (
                  <div className="pt-2 border-t">
                    <p className="text-sm font-medium text-gray-600">Note Consegna</p>
                    <p className="text-sm mt-1">{(ordine as any).noteConsegna}</p>
                  </div>
                )}
                <div className="pt-2 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() =>
                      openNavigation({
                        indirizzo: ordine.indirizzoConsegna,
                        citta: ordine.paziente?.citta,
                        cap: ordine.paziente?.cap,
                        provincia: ordine.paziente?.provincia,
                        latitudine: ordine.paziente?.latitudine,
                        longitudine: ordine.paziente?.longitudine,
                      })
                    }
                  >
                    <Navigation className="h-4 w-4 mr-2" />
                    Apri Navigazione
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Riepilogo Colli — solo info logistica, nessun dato medico */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Riepilogo Consegna
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-blue-50 border border-blue-200">
                  <div className="flex items-center gap-2">
                    <Package className="h-5 w-5 text-blue-600" />
                    <span className="font-medium">Colli da consegnare</span>
                  </div>
                  <span className="text-lg font-bold text-blue-700">
                    {farmaci.length || 1}
                  </span>
                </div>
                {(ordine as any).zonaConsegna && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Zona:</span>
                    <span className="font-medium">{(ordine as any).zonaConsegna}</span>
                  </div>
                )}
                {(ordine as any).flussoConsegna && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Flusso:</span>
                    <span className="font-medium capitalize">
                      {(ordine as any).flussoConsegna.replace(/_/g, " ")}
                    </span>
                  </div>
                )}
                <div className="pt-2 border-t">
                  <p className="text-xs text-gray-400 italic">
                    I contenuti medici sono cifrati end-to-end e visibili solo alla farmacia.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Colonna laterale */}
        <div className="space-y-6">
          {/* Riepilogo Ordine */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Informazioni Ordine
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm font-medium text-gray-600">Data Creazione</p>
                <p className="mt-1">{formatDateTime(ordine.dataCreazione)}</p>
              </div>
              {ordine.dataConsegnaPrevista && (
                <div>
                  <p className="text-sm font-medium text-gray-600">Consegna Prevista</p>
                  <p className="mt-1">{formatDate(ordine.dataConsegnaPrevista)}</p>
                </div>
              )}
              {(ordine as any).dataAssegnazioneRider && (
                <div>
                  <p className="text-sm font-medium text-gray-600">Assegnato il</p>
                  <p className="mt-1">{formatDateTime((ordine as any).dataAssegnazioneRider)}</p>
                </div>
              )}
              {(ordine as any).dataInConsegna && (
                <div>
                  <p className="text-sm font-medium text-gray-600">In Consegna dal</p>
                  <p className="mt-1">{formatDateTime((ordine as any).dataInConsegna)}</p>
                </div>
              )}
              {((ordine as any).dataConsegna || ordine.dataConsegnaEffettiva) && (
                <div>
                  <p className="text-sm font-medium text-gray-600">Consegnato il</p>
                  <p className="mt-1">{formatDateTime((ordine as any).dataConsegna || ordine.dataConsegnaEffettiva)}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Riepilogo Costi */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Euro className="h-5 w-5" />
                Riepilogo Costi
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span>Totale Ordine:</span>
                <span className="font-medium">
                  €{Number((ordine as any).totale || ordine.importoTotale || 0).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Metodo Pagamento:</span>
                <span className="font-medium">{(ordine as any).metodoPagamento || "n/d"}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Stato Pagamento:</span>
                <span className="font-medium">{(ordine as any).statoPagamento || "n/d"}</span>
              </div>
            </CardContent>
          </Card>

          {pagamentoContrassegno && (
            <Card className="border-amber-200 bg-amber-50/40">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-amber-700" />
                  Incasso Contrassegno
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-1">Importo incassato</p>
                  <Input
                    type="number"
                    step="0.01"
                    value={incassoImporto}
                    onChange={(e) => setIncassoImporto(e.target.value)}
                    placeholder="0.00"
                    disabled={incassoRegistrato}
                  />
                </div>

                {(multiPosConfig?.terminals?.length ?? 0) > 0 && (
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-1">Terminale POS</p>
                    <select
                      value={incassoPosId}
                      onChange={(e) => setIncassoPosId(e.target.value)}
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm bg-white"
                      disabled={incassoRegistrato}
                    >
                      <option value="">Seleziona POS</option>
                      {(multiPosConfig?.terminals ?? [])
                        .filter((terminal) => terminal.enabled !== false)
                        .map((terminal) => (
                          <option key={terminal.id} value={terminal.id}>
                            {terminal.label}{terminal.provider ? ` (${terminal.provider})` : ""}
                          </option>
                        ))}
                    </select>
                  </div>
                )}

                <div>
                  <p className="text-sm font-medium text-gray-700 mb-1">Riferimento operazione POS</p>
                  <Input
                    value={incassoRiferimento}
                    onChange={(e) => setIncassoRiferimento(e.target.value)}
                    placeholder="Es. ID transazione"
                    disabled={incassoRegistrato}
                  />
                </div>

                <div>
                  <p className="text-sm font-medium text-gray-700 mb-1">Note incasso</p>
                  <Input
                    value={incassoNote}
                    onChange={(e) => setIncassoNote(e.target.value)}
                    placeholder="Note opzionali"
                    disabled={incassoRegistrato}
                  />
                </div>

                {!incassoRegistrato ? (
                  <Button
                    className="w-full bg-amber-600 hover:bg-amber-700"
                    onClick={() => registraIncassoMutation.mutate()}
                    disabled={registraIncassoMutation.isPending || Number(incassoImporto || 0) <= 0}
                  >
                    {registraIncassoMutation.isPending ? "Registrazione..." : "Registra Incasso"}
                  </Button>
                ) : (
                  <div className="text-sm text-green-700 bg-green-100 border border-green-200 rounded px-3 py-2">
                    Incasso già registrato
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Note */}
          {ordine.note && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Note
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{ordine.note}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Modal prova di consegna */}
      <ConfermaConsegnaModal
        open={showConfermaModal}
        ordineId={ordineId}
        onClose={() => setShowConfermaModal(false)}
        onSuccess={() => {
          setShowConfermaModal(false);
          queryClient.invalidateQueries({ queryKey: ["delivery-rider-ordini"] });
          queryClient.invalidateQueries({ queryKey: ["delivery-ordine", ordineId] });
          toast({
            title: "Ordine consegnato",
            description: "La prova di consegna è stata salvata con successo.",
          });
        }}
      />
    </div>
  );
}
