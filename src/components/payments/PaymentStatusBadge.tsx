"use client";

import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, XCircle, CreditCard, Wallet, Banknote } from "lucide-react";

interface PaymentStatusBadgeProps {
  statoPagamento: string | null;
  metodoPagamento?: string | null;
}

export function PaymentStatusBadge({ statoPagamento, metodoPagamento }: PaymentStatusBadgeProps) {
  if (!statoPagamento) {
    return (
      <Badge variant="outline" className="bg-gray-50 text-gray-600">
        <Clock className="h-3 w-3 mr-1" />
        Non pagato
      </Badge>
    );
  }

  const getStatusIcon = () => {
    switch (statoPagamento) {
      case "paid":
        return <CheckCircle2 className="h-3 w-3 mr-1" />;
      case "pending":
      case "collecting":
        return <Clock className="h-3 w-3 mr-1" />;
      case "failed":
        return <XCircle className="h-3 w-3 mr-1" />;
      default:
        return <Clock className="h-3 w-3 mr-1" />;
    }
  };

  const getStatusVariant = () => {
    switch (statoPagamento) {
      case "paid":
        return "default";
      case "pending":
      case "collecting":
        return "secondary";
      case "failed":
        return "destructive";
      default:
        return "outline";
    }
  };

  const getStatusText = () => {
    switch (statoPagamento) {
      case "paid":
        return "Pagato";
      case "pending":
        return "In attesa";
      case "collecting":
        return "In incasso";
      case "failed":
        return "Fallito";
      case "refunded":
        return "Rimborsato";
      default:
        return statoPagamento;
    }
  };

  const getMethodIcon = () => {
    switch (metodoPagamento) {
      case "carta":
        return <CreditCard className="h-3 w-3 mr-1" />;
      case "paypal":
        return <Wallet className="h-3 w-3 mr-1" />;
      case "contrassegno":
        return <Banknote className="h-3 w-3 mr-1" />;
      default:
        return null;
    }
  };

  return (
    <Badge variant={getStatusVariant() as any} className="flex items-center gap-1">
      {getStatusIcon()}
      {getMethodIcon()}
      <span>{getStatusText()}</span>
      {metodoPagamento && metodoPagamento !== statoPagamento && (
        <span className="text-xs opacity-75">({metodoPagamento})</span>
      )}
    </Badge>
  );
}



