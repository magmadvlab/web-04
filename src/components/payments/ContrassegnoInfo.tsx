"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ContrassegnoInfoProps {
  totale: number;
  commissionePercentuale?: number;
}

export function ContrassegnoInfo({ totale, commissionePercentuale = 5 }: ContrassegnoInfoProps) {
  const commissione = totale * (commissionePercentuale / 100);
  const totaleConCommissione = totale + commissione;

  return (
    <Card className="border-yellow-200 bg-yellow-50">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Info className="h-5 w-5 text-yellow-600" />
          <CardTitle className="text-lg">Pagamento alla Consegna</CardTitle>
        </div>
        <CardDescription>
          Il pagamento verrà effettuato direttamente al fattorino al momento della consegna
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Totale ordine:</span>
          <span className="font-semibold">€{totale.toFixed(2)}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Commissione incasso ({commissionePercentuale}%):</span>
          <span className="font-semibold text-yellow-700">+€{commissione.toFixed(2)}</span>
        </div>
        <div className="border-t pt-2 flex items-center justify-between">
          <span className="font-semibold">Totale da pagare:</span>
          <span className="text-lg font-bold text-yellow-700">€{totaleConCommissione.toFixed(2)}</span>
        </div>
        <div className="flex items-start gap-2 mt-3 p-2 bg-yellow-100 rounded-md">
          <AlertCircle className="h-4 w-4 text-yellow-700 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-yellow-800">
            La commissione di incasso viene applicata per il servizio di pagamento contrassegno.
            Il fattorino incasserà l'intero importo al momento della consegna.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}



