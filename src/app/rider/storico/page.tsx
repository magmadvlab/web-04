"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loading } from "@/components/shared/Loading";
import {
  MapPin,
  Calendar,
  Home,
  MailOpen,
  Users,
  HelpCircle,
  Camera,
  User,
  FileText,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
} from "lucide-react";

interface ConsegnaStorico {
  id: number;
  codiceOrdine: string;
  indirizzoConsegna: string;
  zonaConsegna?: string | null;
  dataConsegna?: string | null;
  fotoConsegnaUrl?: string | null;
  modalitaConsegna?: string | null;
  ricevutoDa?: string | null;
  noteRiderConsegna?: string | null;
  paziente?: { telefono?: string | null } | null;
  farmacia?: { id: number; nome: string } | null;
}

const MODALITA_CONFIG: Record<string, { icon: React.ReactNode; label: string }> = {
  mani_proprie: { icon: <Home className="h-4 w-4" />, label: "Consegnato a mani proprie" },
  cassetta_postale: { icon: <MailOpen className="h-4 w-4" />, label: "Lasciato in cassetta" },
  portiere_vicino: { icon: <Users className="h-4 w-4" />, label: "Consegnato al portiere/vicino" },
  altro: { icon: <HelpCircle className="h-4 w-4" />, label: "Altra modalità" },
};

function formatDate(val?: string | null) {
  if (!val) return "—";
  const d = new Date(val);
  return isNaN(d.getTime()) ? "—" : d.toLocaleString("it-IT");
}

function CardConsegna({ c }: { c: ConsegnaStorico }) {
  const [aperta, setAperta] = useState(false);
  const modalita = c.modalitaConsegna ? MODALITA_CONFIG[c.modalitaConsegna] : null;
  const haProva = c.fotoConsegnaUrl || c.modalitaConsegna || c.ricevutoDa || c.noteRiderConsegna;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        {/* Header sempre visibile */}
        <button
          className="w-full text-left p-4 flex items-start justify-between gap-3 hover:bg-gray-50 transition-colors"
          onClick={() => setAperta((v) => !v)}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-sm font-semibold text-gray-700">
                {c.codiceOrdine}
              </span>
              {haProva ? (
                <Badge className="bg-green-100 text-green-800 text-xs">
                  <ShieldCheck className="h-3 w-3 mr-1" />
                  Prova disponibile
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs text-gray-500">
                  Nessuna prova
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1 text-sm text-gray-600">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{c.indirizzoConsegna}</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
              <Calendar className="h-3 w-3" />
              {formatDate(c.dataConsegna)}
            </div>
          </div>
          {aperta ? (
            <ChevronUp className="h-4 w-4 text-gray-400 shrink-0 mt-1" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-400 shrink-0 mt-1" />
          )}
        </button>

        {/* Dettaglio prova — espandibile */}
        {aperta && (
          <div className="border-t bg-gray-50 p-4 space-y-4">
            {!haProva && (
              <p className="text-sm text-gray-500 italic">
                Nessuna prova di consegna registrata per questo ordine.
              </p>
            )}

            {/* Foto */}
            {c.fotoConsegnaUrl && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                  <Camera className="h-3 w-3" /> Foto di consegna
                </p>
                <img
                  src={c.fotoConsegnaUrl}
                  alt="Prova di consegna"
                  className="rounded-lg border max-h-64 w-full object-contain bg-white"
                />
              </div>
            )}

            {/* Modalità */}
            {modalita && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-400">{modalita.icon}</span>
                <span className="font-medium">{modalita.label}</span>
              </div>
            )}

            {/* Ricevuto da */}
            {c.ricevutoDa && (
              <div className="flex items-start gap-2 text-sm">
                <User className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <span className="text-xs text-gray-500 block">Ricevuto da</span>
                  <span className="font-medium">{c.ricevutoDa}</span>
                </div>
              </div>
            )}

            {/* Note rider */}
            {c.noteRiderConsegna && (
              <div className="flex items-start gap-2 text-sm">
                <FileText className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <span className="text-xs text-gray-500 block">Note</span>
                  <span>{c.noteRiderConsegna}</span>
                </div>
              </div>
            )}

            {/* Farmacia */}
            {c.farmacia && (
              <p className="text-xs text-gray-400">
                Farmacia: {c.farmacia.nome}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function StoricoConsegnePage() {
  const { data: consegne, isLoading } = useQuery<ConsegnaStorico[]>({
    queryKey: ["rider-storico-consegne"],
    queryFn: async () => {
      const r = await api.get("/delivery/rider/storico-consegne");
      const d = r.data as any;
      return Array.isArray(d?.data) ? d.data : Array.isArray(d) ? d : [];
    },
  });

  if (isLoading) return <Loading />;

  const conProva = consegne?.filter(
    (c) => c.fotoConsegnaUrl || c.modalitaConsegna || c.ricevutoDa
  ) ?? [];

  return (
    <div className="space-y-5 pb-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-green-600" />
          Storico Consegne
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Ultime {consegne?.length ?? 0} consegne completate —{" "}
          <span className="font-medium text-green-700">{conProva.length} con prova fotografica</span>
        </p>
      </div>

      {/* Lista */}
      {!consegne || consegne.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <ShieldCheck className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Nessuna consegna completata ancora.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {consegne.map((c) => (
            <CardConsegna key={c.id} c={c} />
          ))}
        </div>
      )}
    </div>
  );
}
