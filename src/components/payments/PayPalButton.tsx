"use client";

import { useState, useEffect } from "react";
import { PayPalScriptProvider, PayPalButtons, usePayPalScriptReducer } from "@paypal/react-paypal-js";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import api from "@/lib/api";

interface PayPalButtonProps {
  ordineId: number;
  totale: number;
  onSuccess: () => void;
  onError: (error: string) => void;
}

// Componente interno per i bottoni PayPal
function PayPalButtonsInner({ ordineId, totale, onSuccess, onError }: PayPalButtonProps) {
  const [{ isPending }] = usePayPalScriptReducer();
  const { toast } = useToast();

  const createOrder = async () => {
    return `PAYPAL-SANDBOX-${ordineId}-${Date.now()}`;
  };

  const onApprove = async (data: { orderID: string }) => {
    try {
      // Conferma pagamento sul backend
      await api.post("/paziente/payments/confirm", {
        ordineId,
        paypalOrderId: data.orderID,
      });

      toast({
        title: "Pagamento completato",
        description: "Il tuo pagamento PayPal è stato elaborato con successo.",
      });

      onSuccess();
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || "Errore nella conferma del pagamento";
      toast({
        title: "Errore nel pagamento",
        description: errorMessage,
        variant: "destructive",
      });
      onError(errorMessage);
    }
  };

  const onErrorPayPal = (err: any) => {
    const errorMessage = err.message || "Errore nel pagamento PayPal";
    toast({
      title: "Errore nel pagamento",
      description: errorMessage,
      variant: "destructive",
    });
    onError(errorMessage);
  };

  return (
    <div className="space-y-4">
      {isPending && (
        <div className="flex items-center justify-center p-4">
          <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
          <span className="ml-2 text-sm text-gray-600">Caricamento PayPal...</span>
        </div>
      )}
      <PayPalButtons
        createOrder={createOrder}
        onApprove={onApprove}
        onError={onErrorPayPal}
        style={{
          layout: "vertical",
          color: "blue",
          shape: "rect",
          label: "paypal",
        }}
      />
    </div>
  );
}

// Componente wrapper con PayPal Script Provider
export function PayPalButton({ ordineId, totale, onSuccess, onError }: PayPalButtonProps) {
  const [clientId, setClientId] = useState<string | null>(null);

  useEffect(() => {
    const paypalClientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
    if (paypalClientId) {
      setClientId(paypalClientId);
    } else {
      console.warn("NEXT_PUBLIC_PAYPAL_CLIENT_ID non configurata");
    }
  }, []);

  if (!clientId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-blue-500" />
            Pagamento con PayPal
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="p-3 bg-yellow-50 rounded-md text-sm text-yellow-800">
            <p>PayPal non configurato. Configura NEXT_PUBLIC_PAYPAL_CLIENT_ID nel file .env.local</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-blue-500" />
          Pagamento con PayPal
        </CardTitle>
        <CardDescription>
          Importo da pagare: <span className="font-semibold">€{totale.toFixed(2)}</span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <PayPalScriptProvider
          options={{
            clientId,
            currency: "EUR",
            intent: "capture",
          }}
        >
          <PayPalButtonsInner
            ordineId={ordineId}
            totale={totale}
            onSuccess={onSuccess}
            onError={onError}
          />
        </PayPalScriptProvider>
      </CardContent>
    </Card>
  );
}


