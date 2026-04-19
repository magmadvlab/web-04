import { AxiosError } from "axios";
import type { ApiResponse } from "@/types/api";

/**
 * Converte errori tecnici in messaggi user-friendly
 */
export function getErrorMessage(error: unknown): string {
  const normalizeMessage = (value: unknown): string => {
    if (typeof value === "string") return value;
    if (Array.isArray(value)) {
      return value.map((item) => normalizeMessage(item)).filter(Boolean).join(", ");
    }
    if (value && typeof value === "object") {
      const maybeMessage = (value as { message?: unknown }).message;
      if (maybeMessage) return normalizeMessage(maybeMessage);
      try {
        return JSON.stringify(value);
      } catch {
        return "Si è verificato un errore. Riprova più tardi.";
      }
    }
    return "";
  };

  // Se è già una stringa, restituiscila
  if (typeof error === "string") {
    return error;
  }

  // Se è un AxiosError, estrai il messaggio dalla risposta
  if (error instanceof AxiosError) {
    const response = error.response;
    
    // Messaggio personalizzato dal backend
    if (response?.data?.error) {
      const normalized = normalizeMessage(response.data.error);
      if (normalized) return normalized;
    }
    
    if (response?.data?.message) {
      const normalized = normalizeMessage(response.data.message);
      if (normalized) return normalized;
    }

    // Messaggi basati sullo status code
    switch (response?.status) {
      case 400:
        return "Richiesta non valida. Controlla i dati inseriti.";
      case 401:
        return "Non autorizzato. Effettua il login.";
      case 403:
        return "Accesso negato. Non hai i permessi necessari.";
      case 404:
        return "Risorsa non trovata.";
      case 409:
        return "Conflitto. La risorsa potrebbe già esistere.";
      case 422:
        return "Dati non validi. Controlla i campi inseriti.";
      case 429:
        return "Troppe richieste. Riprova tra qualche istante.";
      case 500:
        return "Errore del server. Riprova più tardi.";
      case 502:
      case 503:
      case 504:
        return "Servizio temporaneamente non disponibile. Riprova più tardi.";
      default:
        if (error.message) {
          return error.message;
        }
        return "Si è verificato un errore. Riprova più tardi.";
    }
  }

  // Se è un Error standard
  if (error instanceof Error) {
    return error.message;
  }

  // Messaggio di default
  return "Si è verificato un errore imprevisto. Riprova più tardi.";
}

/**
 * Hook per gestire errori API in modo centralizzato
 */
export function useErrorHandler() {
  const handleError = (error: unknown): string => {
    const message = getErrorMessage(error);
    // Qui potresti anche loggare l'errore a un servizio di monitoring
    // es: logErrorToService(error);
    return message;
  };

  const handleApiError = (error: unknown): string => {
    if (error instanceof AxiosError) {
      const response = error.response;
      
      // Log errore per debugging (solo in sviluppo)
      if (process.env.NODE_ENV === "development") {
        console.error("API Error:", {
          status: response?.status,
          data: response?.data,
          url: error.config?.url,
        });
      }
    }
    
    return handleError(error);
  };

  return {
    handleError,
    handleApiError,
    getErrorMessage,
  };
}

/**
 * Verifica se un errore è un errore di rete (nessuna connessione)
 */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof AxiosError) {
    return !error.response && error.request;
  }
  return false;
}

/**
 * Verifica se un errore è un errore di autenticazione
 */
export function isAuthError(error: unknown): boolean {
  if (error instanceof AxiosError) {
    return error.response?.status === 401 || error.response?.status === 403;
  }
  return false;
}

