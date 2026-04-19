"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import api from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loading } from "@/components/shared/Loading";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import type { ApiResponse, Ordine } from "@/types/api";
import Link from "next/link";
import { ConfermaConsegnaModal } from "@/components/delivery/ConfermaConsegnaModal";

export default function DeliveryOrdiniPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedOrdineId, setSelectedOrdineId] = useState<number | null>(null);
  const [marcaInConsegnaLoading, setMarcaInConsegnaLoading] = useState<number | null>(null);

  const { data: ordini, isLoading } = useQuery<Ordine[]>({
    queryKey: ["delivery-rider-ordini"],
    queryFn: async () => {
      const response = await api.get<ApiResponse<Ordine[]>>("/delivery/rider/ordini");
      return response.data.data;
    },
  });

  const handleMarcaInConsegna = async (ordineId: number) => {
    setMarcaInConsegnaLoading(ordineId);
    try {
      await api.put(`/delivery/ordini/${ordineId}/in-consegna`);
      queryClient.invalidateQueries({ queryKey: ["delivery-rider-ordini"] });
      toast({ title: "Ordine aggiornato", description: "Ordine marcato come in consegna" });
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error?.response?.data?.error || "Errore durante l'aggiornamento",
        variant: "destructive",
      });
    } finally {
      setMarcaInConsegnaLoading(null);
    }
  };

  if (isLoading) {
    return <Loading />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Ordini Assegnati</h1>
        <p className="text-gray-600 mt-2">
          Gestisci gli ordini assegnati per la consegna
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista Ordini</CardTitle>
        </CardHeader>
        <CardContent>
          {ordini && ordini.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Codice Ordine</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Paziente</TableHead>
                  <TableHead>Indirizzo</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead>Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ordini.map((ordine) => (
                  <TableRow key={ordine.id}>
                    <TableCell className="font-medium">#{ordine.id}</TableCell>
                    <TableCell>
                      <span className={`rounded-full px-2 py-1 text-xs ${
                        (ordine as any).prescrizioneId && (ordine as any).farmaciDaBanco?.length > 0
                          ? 'bg-violet-100 text-violet-800'
                          : (ordine as any).prescrizioneId
                            ? 'bg-sky-100 text-sky-800'
                            : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {(ordine as any).prescrizioneId && (ordine as any).farmaciDaBanco?.length > 0
                          ? 'Misto'
                          : (ordine as any).prescrizioneId
                            ? 'Prescrizione'
                            : 'OTC'}
                      </span>
                    </TableCell>
                    <TableCell>
                      {ordine.paziente
                        ? `${ordine.paziente.nome} ${ordine.paziente.cognome}`
                        : "-"}
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {ordine.indirizzoConsegna || "-"}
                    </TableCell>
                    <TableCell>
                      <span className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-800">
                        {ordine.stato}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {(ordine.stato === "assegnato_rider" || ordine.stato === "pronto" || ordine.stato === "pronto_ritiro") && (
                          <Button
                            size="sm"
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                            onClick={() => handleMarcaInConsegna(ordine.id)}
                            disabled={marcaInConsegnaLoading === ordine.id}
                          >
                            {marcaInConsegnaLoading === ordine.id ? "..." : "Metti In Consegna"}
                          </Button>
                        )}
                        {ordine.stato === "in_consegna" && (
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white"
                            onClick={() => setSelectedOrdineId(ordine.id)}
                          >
                            Marca Consegnato
                          </Button>
                        )}
                        <Link href={`/delivery/ordini/${ordine.id}`}>
                          <Button size="sm" variant="outline">
                            Dettagli
                          </Button>
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-center py-8 text-gray-600">
              Nessun ordine trovato
            </p>
          )}
        </CardContent>
      </Card>

      {/* Modal prova di consegna */}
      {selectedOrdineId !== null && (
        <ConfermaConsegnaModal
          open={true}
          ordineId={selectedOrdineId}
          onClose={() => setSelectedOrdineId(null)}
          onSuccess={() => {
            setSelectedOrdineId(null);
            queryClient.invalidateQueries({ queryKey: ["delivery-rider-ordini"] });
            toast({
              title: "Consegna confermata ✓",
              description: "La prova di consegna è stata salvata.",
            });
          }}
        />
      )}
    </div>
  );
}
