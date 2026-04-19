"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreditCard, Wallet, Banknote, Check } from "lucide-react";
import { ContrassegnoInfo } from "./ContrassegnoInfo";
import { cn } from "@/lib/utils";

export type MetodoPagamento = "carta" | "paypal" | "contrassegno";

interface PaymentMethodSelectorProps {
  totale: number;
  onSelect: (metodo: MetodoPagamento) => void;
  selected?: MetodoPagamento;
  commissionePercentuale?: number;
}

export function PaymentMethodSelector({
  totale,
  onSelect,
  selected,
  commissionePercentuale = 5,
}: PaymentMethodSelectorProps) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Seleziona Metodo di Pagamento</CardTitle>
          <CardDescription>Scegli come vuoi pagare il tuo ordine</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => onSelect("carta")}
              className={cn(
                "w-full flex items-center gap-3 p-4 border rounded-lg hover:bg-gray-50 cursor-pointer text-left transition-colors",
                selected === "carta" && "border-blue-500 bg-blue-50"
              )}
            >
              <div className={cn(
                "h-5 w-5 rounded-full border-2 flex items-center justify-center",
                selected === "carta" ? "border-blue-500 bg-blue-500" : "border-gray-300"
              )}>
                {selected === "carta" && <Check className="h-3 w-3 text-white" />}
              </div>
              <CreditCard className="h-5 w-5 text-blue-600" />
              <div className="flex-1">
                <div className="font-semibold">Carta di Credito/Debito</div>
                <div className="text-sm text-gray-500">Pagamento sicuro con Stripe</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => onSelect("paypal")}
              className={cn(
                "w-full flex items-center gap-3 p-4 border rounded-lg hover:bg-gray-50 cursor-pointer text-left transition-colors",
                selected === "paypal" && "border-blue-500 bg-blue-50"
              )}
            >
              <div className={cn(
                "h-5 w-5 rounded-full border-2 flex items-center justify-center",
                selected === "paypal" ? "border-blue-500 bg-blue-500" : "border-gray-300"
              )}>
                {selected === "paypal" && <Check className="h-3 w-3 text-white" />}
              </div>
              <Wallet className="h-5 w-5 text-blue-500" />
              <div className="flex-1">
                <div className="font-semibold">PayPal</div>
                <div className="text-sm text-gray-500">Paga con il tuo account PayPal</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => onSelect("contrassegno")}
              className={cn(
                "w-full flex items-center gap-3 p-4 border rounded-lg hover:bg-gray-50 cursor-pointer text-left transition-colors",
                selected === "contrassegno" && "border-green-500 bg-green-50"
              )}
            >
              <div className={cn(
                "h-5 w-5 rounded-full border-2 flex items-center justify-center",
                selected === "contrassegno" ? "border-green-500 bg-green-500" : "border-gray-300"
              )}>
                {selected === "contrassegno" && <Check className="h-3 w-3 text-white" />}
              </div>
              <Banknote className="h-5 w-5 text-green-600" />
              <div className="flex-1">
                <div className="font-semibold">Contrassegno</div>
                <div className="text-sm text-gray-500">Paga alla consegna (+{commissionePercentuale}% commissione)</div>
              </div>
            </button>
          </div>
        </CardContent>
      </Card>

      {selected === "contrassegno" && (
        <ContrassegnoInfo totale={totale} commissionePercentuale={commissionePercentuale} />
      )}
    </div>
  );
}

