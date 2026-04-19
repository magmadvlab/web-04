import { toast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/hooks/useErrorHandler";

/**
 * Mostra un toast di errore con messaggio user-friendly
 */
export function showErrorToast(error: unknown, title: string = "Errore") {
  const message = getErrorMessage(error);
  
  toast({
    variant: "destructive",
    title,
    description: message,
  });
}

/**
 * Mostra un toast di successo
 */
export function showSuccessToast(message: string, title: string = "Successo") {
  toast({
    variant: "default",
    title,
    description: message,
  });
}

/**
 * Mostra un toast informativo
 */
export function showInfoToast(message: string, title: string = "Info") {
  toast({
    variant: "default",
    title,
    description: message,
  });
}


