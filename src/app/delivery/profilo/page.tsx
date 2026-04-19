"use client";

import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loading } from "@/components/shared/Loading";
import type { ApiResponse, Rider } from "@/types/api";

export default function DeliveryProfiloPage() {
  const { data: profile, isLoading } = useQuery<Rider>({
    queryKey: ["delivery-rider-profile"],
    queryFn: async () => {
      const response = await api.get<ApiResponse<Rider>>("/delivery/rider/profile");
      return response.data.data;
    },
  });

  if (isLoading) {
    return <Loading />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Profilo Rider</h1>
        <p className="text-gray-600 mt-2">
          Le tue informazioni personali
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informazioni Personali</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {profile && (
            <>
              <div>
                <p className="text-sm font-medium text-gray-500">Nome</p>
                <p className="text-lg">{profile.nome} {profile.cognome}</p>
              </div>
              {profile.telefono && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Telefono</p>
                  <p className="text-lg">{profile.telefono}</p>
                </div>
              )}
              {profile.mezzoTrasporto && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Mezzo di Trasporto</p>
                  <p className="text-lg">{profile.mezzoTrasporto}</p>
                </div>
              )}
              {profile.targaMezzo && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Targa</p>
                  <p className="text-lg">{profile.targaMezzo}</p>
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-gray-500">Stato</p>
                <p className="text-lg">
                  {profile.disponibile ? (
                    <span className="text-green-600">Disponibile</span>
                  ) : (
                    <span className="text-red-600">Non disponibile</span>
                  )}
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

