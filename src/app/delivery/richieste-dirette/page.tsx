"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loading } from "@/components/shared/Loading";
import { useToast } from "@/hooks/use-toast";
import type { ApiResponse } from "@/types/api";
import {
  Stethoscope,
  MapPin,
  Clock,
  User,
  Phone,
  Package,
  AlertTriangle,
  CheckCircle2,
  Euro
} from "lucide-react";
import { motion } from "framer-motion";

interface DirectDeliveryRequest {
  id: number;
  medico: { nome: string; cognome: string; telefono: string };
  paziente: { nome: string; cognome: string; telefono: string };
  farmaciRichiesti: Array<{
    nomeFarmaco: string;
    quantita: number;
    principioAttivo?: string;
    posologia?: string;
  }>;
  indirizzoConsegna: string;
  livelloUrgenza: 'normale' | 'urgente' | 'critico';
  stato: string;
  costoStimato: number;
  dataRichiesta: string;
  finestraOraria?: string;
  noteMedico?: string;
}

export default function RichiesteDirectePage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: richieste, isLoading } = useQuery<DirectDeliveryRequest[]>({
    queryKey: ["delivery-direct-requests"],
    queryFn: async () => {
      const response = await api.get<ApiResponse<DirectDeliveryRequest[]>>("/direct-delivery/rider/richieste-disponibili");
      return response.data.data;
    },
  });

  const accettaRichiestaMutation = useMutation({
    mutationFn: async (requestId: number) => {
      await api.post(`/direct-delivery/rider/richieste/${requestId}/accetta`, {
        noteAssegnazione: "Richiesta accettata da dashboard rider"
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["delivery-direct-requests"] });
      toast({
        title: "Richiesta accettata",
        description: "La richiesta è stata assegnata a te con successo",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error?.response?.data?.error || "Errore durante l'accettazione",
        variant: "destructive",
      });
    },
  });

  const handleAccettaRichiesta = (requestId: number) => {
    accettaRichiestaMutation.mutate(requestId);
  };

  const getUrgencyColor = (urgenza: string) => {
    switch (urgenza) {
      case 'critico': return 'bg-red-100 text-red-800 border-red-200';
      case 'urgente': return 'bg-orange-100 text-orange-800 border-orange-200';
      default: return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  const getUrgencyIcon = (urgenza: string) => {
    switch (urgenza) {
      case 'critico': return <AlertTriangle className="h-4 w-4" />;
      case 'urgente': return <Clock className="h-4 w-4" />;
      default: return <CheckCircle2 className="h-4 w-4" />;
    }
  };

  if (isLoading) {
    return <Loading />;
  }

  const richiesteUrgenti = richieste?.filter(r => r.livelloUrgenza === 'urgente' || r.livelloUrgenza === 'critico') || [];
  const richiesteNormali = richieste?.filter(r => r.livelloUrgenza === 'normale') || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Richieste Delivery Dirette</h1>
          <p className="text-gray-600 mt-2">
            Richieste di consegna farmaci direttamente dai medici
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
            {richiesteUrgenti.length} Urgenti
          </Badge>
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            {richiesteNormali.length} Normali
          </Badge>
        </div>
      </div>

      {/* Richieste Urgenti */}
      {richiesteUrgenti.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Card className="border-red-200 bg-red-50/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-700">
                <AlertTriangle className="h-5 w-5" />
                Richieste Urgenti ({richiesteUrgenti.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {richiesteUrgenti.map((richiesta, index) => (
                  <motion.div
                    key={richiesta.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.1 }}
                    className="p-4 rounded-lg border border-red-200 bg-white hover:shadow-md transition-all"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 space-y-3">
                        {/* Header richiesta */}
                        <div className="flex items-center gap-3">
                          <Badge className={getUrgencyColor(richiesta.livelloUrgenza)}>
                            {getUrgencyIcon(richiesta.livelloUrgenza)}
                            {(richiesta.livelloUrgenza || "").toUpperCase()}
                          </Badge>
                          <span className="text-sm text-gray-500">
                            {new Date(richiesta.dataRichiesta).toLocaleString('it-IT')}
                          </span>
                        </div>

                        {/* Medico */}
                        <div className="flex items-center gap-2">
                          <Stethoscope className="h-4 w-4 text-blue-600" />
                          <span className="font-medium">
                            Dr. {richiesta.medico.nome} {richiesta.medico.cognome}
                          </span>
                          <Phone className="h-3 w-3 text-gray-400 ml-2" />
                          <span className="text-sm text-gray-600">{richiesta.medico.telefono}</span>
                        </div>

                        {/* Paziente */}
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-green-600" />
                          <span className="font-medium">
                            {richiesta.paziente.nome} {richiesta.paziente.cognome}
                          </span>
                          <Phone className="h-3 w-3 text-gray-400 ml-2" />
                          <span className="text-sm text-gray-600">{richiesta.paziente.telefono}</span>
                        </div>

                        {/* Indirizzo */}
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-orange-600" />
                          <span className="text-sm">{richiesta.indirizzoConsegna}</span>
                          {richiesta.finestraOraria && (
                            <>
                              <Clock className="h-3 w-3 text-gray-400 ml-2" />
                              <span className="text-sm text-gray-600">{richiesta.finestraOraria}</span>
                            </>
                          )}
                        </div>

                        {/* Farmaci */}
                        <div className="flex items-start gap-2">
                          <Package className="h-4 w-4 text-purple-600 mt-0.5" />
                          <div className="flex-1">
                            <div className="text-sm font-medium mb-1">
                              {richiesta.farmaciRichiesti.length} farmaci richiesti:
                            </div>
                            <div className="space-y-1">
                              {richiesta.farmaciRichiesti.slice(0, 3).map((farmaco, idx) => (
                                <div key={idx} className="text-xs text-gray-600 bg-gray-50 px-2 py-1 rounded">
                                  <span className="font-medium">{farmaco.nomeFarmaco}</span>
                                  {farmaco.quantita && <span className="ml-2">x{farmaco.quantita}</span>}
                                  {farmaco.posologia && (
                                    <span className="ml-2 text-gray-500">({farmaco.posologia})</span>
                                  )}
                                </div>
                              ))}
                              {richiesta.farmaciRichiesti.length > 3 && (
                                <div className="text-xs text-gray-500">
                                  +{richiesta.farmaciRichiesti.length - 3} altri farmaci
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Note medico */}
                        {richiesta.noteMedico && (
                          <div className="bg-blue-50 p-3 rounded-lg">
                            <div className="text-sm font-medium text-blue-800 mb-1">Note del medico:</div>
                            <div className="text-sm text-blue-700">{richiesta.noteMedico}</div>
                          </div>
                        )}

                        {/* Costo */}
                        <div className="flex items-center gap-2">
                          <Euro className="h-4 w-4 text-green-600" />
                          <span className="font-medium text-green-700">
                            Costo stimato: €{Number(richiesta.costoStimato || 0).toFixed(2)}
                          </span>
                        </div>
                      </div>

                      {/* Azioni */}
                      <div className="flex flex-col gap-2 ml-4">
                        <Button
                          onClick={() => handleAccettaRichiesta(richiesta.id)}
                          disabled={accettaRichiestaMutation.isPending}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          Accetta Urgente
                        </Button>
                        <Button variant="outline" size="sm">
                          Dettagli
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Richieste Normali */}
      {richiesteNormali.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-blue-600" />
                Richieste Normali ({richiesteNormali.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {richiesteNormali.map((richiesta, index) => (
                  <motion.div
                    key={richiesta.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: 0.3 + index * 0.1 }}
                    className="p-4 rounded-lg border hover:shadow-md transition-all"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 space-y-2">
                        {/* Header compatto */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Badge className={getUrgencyColor(richiesta.livelloUrgenza)}>
                              {getUrgencyIcon(richiesta.livelloUrgenza)}
                              NORMALE
                            </Badge>
                            <span className="font-medium">
                              Dr. {richiesta.medico.nome} {richiesta.medico.cognome}
                            </span>
                          </div>
                          <span className="text-xs text-gray-500">
                            {new Date(richiesta.dataRichiesta).toLocaleString('it-IT')}
                          </span>
                        </div>

                        {/* Info compatte */}
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <div className="flex items-center gap-1 mb-1">
                              <User className="h-3 w-3 text-green-600" />
                              <span className="font-medium">
                                {richiesta.paziente.nome} {richiesta.paziente.cognome}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 text-gray-600">
                              <MapPin className="h-3 w-3" />
                              <span className="truncate">{richiesta.indirizzoConsegna}</span>
                            </div>
                          </div>
                          <div>
                            <div className="flex items-center gap-1 mb-1">
                              <Package className="h-3 w-3 text-purple-600" />
                              <span>{richiesta.farmaciRichiesti.length} farmaci</span>
                            </div>
                            <div className="flex items-center gap-1 text-green-700">
                              <Euro className="h-3 w-3" />
                              <span className="font-medium">€{Number(richiesta.costoStimato || 0).toFixed(2)}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Azioni compatte */}
                      <div className="flex gap-2 ml-4">
                        <Button
                          size="sm"
                          onClick={() => handleAccettaRichiesta(richiesta.id)}
                          disabled={accettaRichiestaMutation.isPending}
                        >
                          Accetta
                        </Button>
                        <Button variant="outline" size="sm">
                          Dettagli
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Nessuna richiesta */}
      {(!richieste || richieste.length === 0) && (
        <Card>
          <CardContent className="text-center py-12">
            <Stethoscope className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Nessuna richiesta disponibile
            </h3>
            <p className="text-gray-600">
              Al momento non ci sono richieste di delivery dirette dai medici.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}