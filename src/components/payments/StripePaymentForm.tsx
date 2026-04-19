"use client";

import { useState, useEffect } from "react";
import { loadStripe, StripeElementsOptions } from "@stripe/stripe-js";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreditCard, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import api from "@/lib/api";

interface StripePaymentFormProps {
  ordineId: number;
  totale: number;
  pazienteId?: number;
  farmaciaId?: number;
  onSuccess: () => void;
  onError: (error: string) => void;
}

// Componente interno per il form Stripe
function StripePaymentFormInner({
  ordineId,
  totale,
  pazienteId,
  farmaciaId,
  onSuccess,
  onError,
}: StripePaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setLoading(true);

    try {
      if (ordineId <= 0) {
        throw new Error("Salvataggio carta non disponibile in questa build");
      }

      if (!pazienteId || !farmaciaId) {
        throw new Error("Dati ordine incompleti per il pagamento");
      }

      // Crea payment intent
      const response = await api.post("/paziente/payments/create-intent", {
        ordineId,
        metodoPagamento: "carta",
        importo: totale,
        farmaciaId,
        pazienteId,
      });

      const { clientSecret, paymentIntentId } = response.data?.data ?? response.data;

      if (!clientSecret) {
        throw new Error("Errore nella creazione del payment intent");
      }

      // Conferma pagamento con Stripe
      const cardElement = elements.getElement(CardElement);
      if (!cardElement) {
        throw new Error("Elemento carta non trovato");
      }

      const { error: confirmError, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardElement,
        },
      });

      if (confirmError) {
        throw new Error(confirmError.message || "Errore nella conferma del pagamento");
      }

      if (paymentIntent?.status === "succeeded") {
        // Conferma pagamento sul backend
        await api.post("/paziente/payments/confirm", {
          ordineId,
          paymentIntentId,
        });

        toast({
          title: "Pagamento completato",
          description: "Il tuo pagamento è stato elaborato con successo.",
        });

        onSuccess();
      } else {
        throw new Error("Pagamento non completato");
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || "Errore sconosciuto";
      toast({
        title: "Errore nel pagamento",
        description: errorMessage,
        variant: "destructive",
      });
      onError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="p-4 border rounded-lg">
        <CardElement
          options={{
            style: {
              base: {
                fontSize: "16px",
                color: "#424770",
                "::placeholder": {
                  color: "#aab7c4",
                },
              },
              invalid: {
                color: "#9e2146",
              },
            },
          }}
        />
      </div>

      <Button type="submit" className="w-full" disabled={loading || !stripe}>
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Elaborazione...
          </>
        ) : (
          <>
            <CreditCard className="mr-2 h-4 w-4" />
            Paga €{totale.toFixed(2)}
          </>
        )}
      </Button>
    </form>
  );
}

// Componente wrapper con Stripe Elements
export function StripePaymentForm({
  ordineId,
  totale,
  pazienteId,
  farmaciaId,
  onSuccess,
  onError,
}: StripePaymentFormProps) {
  const [stripePromise, setStripePromise] = useState<Promise<any> | null>(null);

  useEffect(() => {
    const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    if (publishableKey) {
      setStripePromise(loadStripe(publishableKey));
    } else {
      console.warn("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY non configurata");
    }
  }, []);

  if (!stripePromise) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Pagamento con Carta
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="p-3 bg-yellow-50 rounded-md text-sm text-yellow-800">
            <p>Stripe non configurato. Configura NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY nel file .env.local</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const options: StripeElementsOptions = {
    mode: "payment",
    amount: Math.round(totale * 100), // Converti in centesimi
    currency: "eur",
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Pagamento con Carta
        </CardTitle>
        <CardDescription>
          Importo da pagare: <span className="font-semibold">€{totale.toFixed(2)}</span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Elements stripe={stripePromise} options={options}>
          <StripePaymentFormInner
            ordineId={ordineId}
            totale={totale}
            pazienteId={pazienteId}
            farmaciaId={farmaciaId}
            onSuccess={onSuccess}
            onError={onError}
          />
        </Elements>
      </CardContent>
    </Card>
  );
}

