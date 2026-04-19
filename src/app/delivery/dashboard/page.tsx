"use client";

import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loading } from "@/components/shared/Loading";
import { StatCard } from "@/components/ui/stat-card";
import type { ApiResponse, Rider, Ordine } from "@/types/api";
import { ShoppingCart, Truck, MapPin, Clock, CheckCircle2, ArrowRight, Stethoscope, Package, CreditCard, AlertCircle } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { OrdiniCompletatiSettimanaChart } from "@/components/delivery/OrdiniCompletatiSettimanaChart";
import { PerformanceSettimanaleChart } from "@/components/delivery/PerformanceSettimanaleChart";
import { motion } from "framer-motion";

interface DirectDeliveryRequest {
  id: number;
  medico: { nome: string; cognome: string; telefono: string };
  paziente: { nome: string; cognome: string; telefono: string };
  farmaciRichiesti: any[];
  indirizzoConsegna: string;
  livelloUrgenza: 'normale' | 'urgente' | 'critico';
  stato: string;
  costoStimato: number;
  dataRichiesta: string;
}

interface BatchNotifica {
  id: number;
  farmaciaId: number;
  totaleOrdini: number;
  ordiniPronti: number[];
  farmacia: {
    id: number;
    nome: string;
    citta: string;
  };
}

interface BatchRitiriData {
  notifiche: BatchNotifica[];
  totaleNotifiche: number;
  totaleOrdini: number;
}

interface RiderMultiPosConfig {
  terminals: Array<{
    id: string;
    label: string;
    enabled?: boolean;
  }>;
}

const BATCH_ENABLED_RIDER_STATI = new Set(["attivo", "disponibile", "in_consegna"]);
const ASSIGNED_ORDER_STATUSES = new Set(["assegnato_rider", "pronto", "pronto_ritiro"]);

export default function DeliveryDashboard() {
  const { data: profile, isLoading: profileLoading } = useQuery<Rider>({
    queryKey: ["delivery-rider-profile"],
    queryFn: async () => {
      const response = await api.get<ApiResponse<Rider>>("/delivery/rider/profile");
      return response.data.data;
    },
  });

  const riderStato = String(profile?.stato || "").toLowerCase();
  const canLoadBatch = !!profile && (riderStato === "" || BATCH_ENABLED_RIDER_STATI.has(riderStato));
  const batchDisabledByRiderStatus = !!profile && riderStato !== "" && !BATCH_ENABLED_RIDER_STATI.has(riderStato);

  const { data: ordini, isLoading: ordiniLoading } = useQuery<Ordine[]>({
    queryKey: ["delivery-rider-ordini"],
    queryFn: async () => {
      const response = await api.get<ApiResponse<Ordine[]>>("/delivery/rider/ordini");
      return response.data.data;
    },
  });

  // Nuova query per richieste delivery dirette
  const { data: directRequests, isLoading: directRequestsLoading } = useQuery<DirectDeliveryRequest[]>({
    queryKey: ["delivery-direct-requests"],
    queryFn: async () => {
      const response = await api.get<ApiResponse<DirectDeliveryRequest[]>>("/direct-delivery/rider/richieste-disponibili");
      return response.data.data;
    },
  });

  const { data: batchRitiri, isLoading: batchRitiriLoading } = useQuery<BatchRitiriData>({
    queryKey: ["delivery-batch-ritiri-dashboard"],
    queryFn: async () => {
      const response = await api.get<BatchRitiriData>("/delivery/batch/ritiri/ordini-pronti");
      return response.data;
    },
    enabled: canLoadBatch,
  });

  const { data: riderMultiPos, isLoading: riderMultiPosLoading } = useQuery<RiderMultiPosConfig>({
    queryKey: ["delivery-rider-multipos-dashboard"],
    queryFn: async () => {
      const response = await api.get<ApiResponse<RiderMultiPosConfig>>("/delivery/rider/multipos");
      return response.data.data || { terminals: [] };
    },
  });

  if (
    profileLoading ||
    ordiniLoading ||
    directRequestsLoading ||
    riderMultiPosLoading ||
    (canLoadBatch && batchRitiriLoading)
  ) {
    return <Loading />;
  }

  // Ordini tradizionali (farmacia → delivery)
  const ordiniAssegnati = ordini?.filter((o) => ASSIGNED_ORDER_STATUSES.has(o.stato)) || [];
  const ordiniInConsegna = ordini?.filter((o) => o.stato === "in_consegna") || [];
  const ordiniCompletati = ordini?.filter((o) => o.stato === "consegnato") || [];

  // Richieste delivery dirette
  const richiesteDisponibili = directRequests?.filter((r) => r.stato === "richiesta") || [];
  const richiesteUrgenti = richiesteDisponibili.filter((r) => r.livelloUrgenza === "urgente" || r.livelloUrgenza === "critico");
  const batchNotifiche = canLoadBatch ? (batchRitiri?.notifiche || []) : [];
  const ordiniBatchDaRitirare = canLoadBatch ? (batchRitiri?.totaleOrdini || 0) : 0;
  const farmacieBatch = canLoadBatch ? (batchRitiri?.totaleNotifiche || 0) : 0;
  const terminaliPosAttivi = riderMultiPos?.terminals?.filter((terminal) => terminal.enabled !== false).length || 0;

  const totaleOrdini = (ordini?.length || 0) + (directRequests?.length || 0);

  const getUrgencyColor = (urgenza: string) => {
    switch (urgenza) {
      case 'critico': return 'bg-red-100 text-red-800 border-red-200';
      case 'urgente': return 'bg-orange-100 text-orange-800 border-orange-200';
      default: return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  // Render dashboard
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header con gradiente */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative overflow-hidden rounded-lg bg-gradient-to-r from-primary/20 via-primary/10 to-transparent p-6 border border-primary/20"
      >
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Dashboard Delivery
            </h1>
            <p className="text-gray-600 mt-2">
              Benvenuto, {profile?.nome} {profile?.cognome}
            </p>
            <div className="flex gap-2 mt-2">
              {profile?.mezzoTrasporto && (
                <Badge variant="outline">
                  <Truck className="h-3 w-3 mr-1" />
                  {profile.mezzoTrasporto}
                </Badge>
              )}
              {profile?.cittaOperative && (
                <Badge variant="outline">
                  <MapPin className="h-3 w-3 mr-1" />
                  {profile.cittaOperative.join(", ")}
                </Badge>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Link href="/delivery/ordini">
              <Button variant="outline" className="hover-lift">
                Ordini Farmacia
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/delivery/ritiri">
              <Button variant="outline" className="hover-lift">
                Ritiri Batch
                <Package className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/delivery/pos">
              <Button variant="outline" className="hover-lift">
                POS
                <CreditCard className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/delivery/richieste-dirette">
              <Button variant="outline" className="hover-lift">
                Richieste Medici
                <Stethoscope className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
        <div className="absolute inset-0 shimmer opacity-30" />
      </motion.div>

      {/* Statistiche Principali con StatCard */}
      <div className="grid gap-4 md:grid-cols-6">
        <StatCard
          title="Ordini Farmacia"
          value={ordiniAssegnati.length}
          description="Pronti per ritiro"
          icon={Package}
          variant="gradient"
          delay={0.1}
          className="border-blue-200 bg-gradient-to-br from-blue-50/50 to-transparent"
        />

        <StatCard
          title="Richieste Dirette"
          value={richiesteDisponibili.length}
          description="Da medici"
          icon={Stethoscope}
          variant="gradient"
          delay={0.15}
          className="border-green-200 bg-gradient-to-br from-green-50/50 to-transparent"
        />

        <StatCard
          title="In Consegna"
          value={ordiniInConsegna.length}
          description="In corso"
          icon={Truck}
          variant="gradient"
          delay={0.2}
          className="border-orange-200 bg-gradient-to-br from-orange-50/50 to-transparent"
        />

        <StatCard
          title="Ritiri Batch"
          value={ordiniBatchDaRitirare}
          description={`${farmacieBatch} farmacie`}
          icon={ShoppingCart}
          variant="gradient"
          delay={0.25}
          className="border-indigo-200 bg-gradient-to-br from-indigo-50/50 to-transparent"
        />

        <StatCard
          title="Completati"
          value={ordiniCompletati.length}
          description={`di ${totaleOrdini} totali`}
          icon={CheckCircle2}
          variant="gradient"
          delay={0.3}
          className="border-green-200 bg-gradient-to-br from-green-50/50 to-transparent"
        />

        <StatCard
          title="POS Attivi"
          value={terminaliPosAttivi}
          description="Terminali rider"
          icon={CreditCard}
          variant="gradient"
          delay={0.4}
          className="border-slate-200 bg-gradient-to-br from-slate-50/50 to-transparent"
        />

        <StatCard
          title="Urgenti"
          value={richiesteUrgenti.length}
          description="Priorità alta"
          icon={Clock}
          variant="gradient"
          delay={0.45}
          className="border-red-200 bg-gradient-to-br from-red-50/50 to-transparent"
        />
      </div>

      {batchDisabledByRiderStatus && (
        <Card className="border-amber-200 bg-amber-50/70">
          <CardContent className="py-4 text-sm text-amber-900">
            Ritiri batch non disponibili con stato rider "{profile?.stato}". Attiva il profilo rider per vedere gli ordini pronti.
          </CardContent>
        </Card>
      )}

      {!batchDisabledByRiderStatus && profile && ordiniAssegnati.length === 0 && ordiniBatchDaRitirare === 0 && (
        <Card className="border-slate-200 bg-slate-50/80">
          <CardContent className="flex items-start gap-3 py-4 text-sm text-slate-700">
            <AlertCircle className="h-5 w-5 shrink-0 text-slate-500 mt-0.5" />
            <p>
              La copertura rider su{" "}
              <span className="font-medium">
                {profile.cittaOperative?.join(", ") || profile.zonaOperativa || "zona non definita"}
              </span>{" "}
              è attiva. Gli ordini compaiono in <span className="font-medium">Ritiri Batch</span> quando la
              farmacia li segna pronti, mentre <span className="font-medium">Ordini Farmacia</span> mostra solo
              consegne gia assegnate al tuo `riderId`.
            </p>
          </CardContent>
        </Card>
      )}

      {batchNotifiche.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.45 }}
        >
          <Card className="border-indigo-200 bg-indigo-50/30 hover-lift">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-indigo-600" />
                  Ritiri Batch da Farmacie Diverse
                </CardTitle>
                <Badge variant="outline" className="bg-indigo-100 text-indigo-800 border-indigo-200">
                  {farmacieBatch} farmacie | {ordiniBatchDaRitirare} ordini
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {batchNotifiche.slice(0, 3).map((notifica, index) => (
                  <motion.div
                    key={notifica.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: 0.5 + index * 0.1 }}
                  >
                    <div className="p-3 rounded-lg border border-indigo-200 bg-white hover:bg-indigo-50 transition-all hover-lift">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">{notifica.farmacia?.nome || `Farmacia #${notifica.farmaciaId}`}</p>
                          <p className="text-xs text-gray-600">
                            {notifica.farmacia?.citta || "Città non disponibile"} | {notifica.totaleOrdini || notifica.ordiniPronti.length} ordini pronti
                          </p>
                        </div>
                        <Link href="/delivery/ritiri">
                          <Button size="sm" variant="outline">
                            Apri ritiri
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
              <div className="mt-4 text-center">
                <Link href="/delivery/ritiri">
                  <Button variant="ghost" size="sm">
                    Vai alla gestione ritiri batch
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Richieste Dirette Urgenti */}
      {richiesteUrgenti.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
        >
          <Card className="border-red-200 bg-red-50/30 hover-lift">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-red-600" />
                  Richieste Urgenti da Medici
                </CardTitle>
                <Badge variant="outline" className="bg-red-100 text-red-800 border-red-200">
                  {richiesteUrgenti.length} urgenti
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {richiesteUrgenti.slice(0, 3).map((richiesta, index) => (
                  <motion.div
                    key={richiesta.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: 0.6 + index * 0.1 }}
                  >
                    <div className="p-4 rounded-lg border border-red-200 bg-white hover:bg-red-50 transition-all hover-lift">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge className={getUrgencyColor(richiesta.livelloUrgenza)}>
                              {(richiesta.livelloUrgenza || "").toUpperCase()}
                            </Badge>
                            <span className="text-sm text-gray-600">
                              Dr. {richiesta.medico.nome} {richiesta.medico.cognome}
                            </span>
                          </div>
                          <div className="text-sm font-medium mb-1">
                            Paziente: {richiesta.paziente.nome} {richiesta.paziente.cognome}
                          </div>
                          <p className="text-xs text-gray-600 flex items-center gap-1 mb-1">
                            <MapPin className="h-3 w-3" />
                            {richiesta.indirizzoConsegna}
                          </p>
                          <p className="text-xs text-gray-500">
                            {richiesta.farmaciRichiesti.length} farmaci - €{Number(richiesta.costoStimato || 0).toFixed(2)}
                          </p>
                        </div>
                        <div className="flex flex-col gap-2">
                          <Button size="sm" className="bg-red-600 hover:bg-red-700">
                            Accetta Urgente
                          </Button>
                          <Button variant="outline" size="sm">
                            Dettagli
                          </Button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Richieste Dirette Normali */}
      {richiesteDisponibili.filter(r => r.livelloUrgenza === 'normale').length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.7 }}
        >
          <Card className="border-green-200 bg-green-50/30 hover-lift">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Stethoscope className="h-5 w-5 text-green-600" />
                  Richieste Dirette Disponibili
                </CardTitle>
                <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200">
                  {richiesteDisponibili.filter(r => r.livelloUrgenza === 'normale').length} disponibili
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {richiesteDisponibili
                  .filter(r => r.livelloUrgenza === 'normale')
                  .slice(0, 3)
                  .map((richiesta, index) => (
                    <motion.div
                      key={richiesta.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: 0.8 + index * 0.1 }}
                    >
                      <div className="p-3 rounded-lg border border-green-200 bg-white hover:bg-green-50 transition-all hover-lift">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-medium">
                                Dr. {richiesta.medico.nome} {richiesta.medico.cognome}
                              </span>
                            </div>
                            <div className="text-sm mb-1">
                              Paziente: {richiesta.paziente.nome} {richiesta.paziente.cognome}
                            </div>
                            <p className="text-xs text-gray-600 flex items-center gap-1 mb-1">
                              <MapPin className="h-3 w-3" />
                              {richiesta.indirizzoConsegna}
                            </p>
                            <p className="text-xs text-gray-500">
                              {richiesta.farmaciRichiesti.length} farmaci - €{Number(richiesta.costoStimato || 0).toFixed(2)}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline">
                              Accetta
                            </Button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
              </div>
              {richiesteDisponibili.filter(r => r.livelloUrgenza === 'normale').length > 3 && (
                <div className="mt-4 text-center">
                  <Link href="/delivery/richieste-dirette">
                    <Button variant="ghost" size="sm">
                      Vedi tutte le richieste dirette
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Grafici */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.9 }}
        className="grid gap-4 md:grid-cols-2"
      >
        <div className="animate-scale-in">
          <OrdiniCompletatiSettimanaChart ordini={ordini || []} />
        </div>
        <div className="animate-scale-in" style={{ animationDelay: "0.1s" }}>
          <PerformanceSettimanaleChart ordini={ordini || []} />
        </div>
      </motion.div>

      {/* Ordini Tradizionali Assegnati */}
      {ordiniAssegnati.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 1.0 }}
        >
          <Card className="border-blue-200 bg-blue-50/30 hover-lift">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-blue-600" />
                  Ordini Farmacia da Ritirare
                </CardTitle>
                <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-200">
                  {ordiniAssegnati.length} ordini
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {ordiniAssegnati.slice(0, 3).map((ordine, index) => (
                  <motion.div
                    key={ordine.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: 1.1 + index * 0.1 }}
                  >
                    <Link href={`/delivery/ordini/${ordine.id}`}>
                      <div className="p-3 rounded-lg border border-blue-200 bg-white hover:bg-blue-50 transition-all hover-lift">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-sm">
                                {ordine.codiceOrdine || `Ordine #${ordine.id}`}
                              </span>
                              {ordine.farmacia && (
                                <Badge variant="outline" className="text-xs">
                                  {ordine.farmacia.nome}
                                </Badge>
                              )}
                            </div>
                            {ordine.indirizzoConsegna && (
                              <p className="text-xs text-gray-600 flex items-center gap-1 mt-1">
                                <MapPin className="h-3 w-3" />
                                {ordine.indirizzoConsegna}
                              </p>
                            )}
                            {ordine.totale && (
                              <p className="text-xs text-gray-500 mt-1">
                                Totale: €{Number(ordine.totale || 0).toFixed(2)}
                              </p>
                            )}
                          </div>
                          <Button variant="outline" size="sm">
                            Ritira
                          </Button>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
              {ordiniAssegnati.length > 3 && (
                <div className="mt-4 text-center">
                  <Link href="/delivery/ordini">
                    <Button variant="ghost" size="sm">
                      Vedi tutti gli ordini farmacia ({ordiniAssegnati.length})
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
