/**
 * Utility per gestione token JWT in fase di sviluppo/test
 */

export interface TokenInfo {
  isValid: boolean;
  expiresAt: Date | null;
  expiresIn: number | null; // millisecondi rimanenti
  isExpiringSoon: boolean; // true se scade entro 5 minuti
}

/**
 * Decodifica un token JWT (senza verifica della firma)
 * Utile solo per leggere i dati del payload
 */
export function decodeJWT(token: string): any | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }
    const payload = parts[1];
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded);
  } catch (error) {
    console.error('Error decoding JWT:', error);
    return null;
  }
}

/**
 * Analizza un token e restituisce informazioni sulla sua validità
 */
export function analyzeToken(token: string | null): TokenInfo {
  if (!token) {
    return {
      isValid: false,
      expiresAt: null,
      expiresIn: null,
      isExpiringSoon: false,
    };
  }

  const decoded = decodeJWT(token);
  if (!decoded || !decoded.exp) {
    return {
      isValid: false,
      expiresAt: null,
      expiresIn: null,
      isExpiringSoon: false,
    };
  }

  const expiresAt = new Date(decoded.exp * 1000);
  const now = new Date();
  const expiresIn = expiresAt.getTime() - now.getTime();
  const isValid = expiresIn > 0;
  const isExpiringSoon = isValid && expiresIn < 5 * 60 * 1000; // 5 minuti

  return {
    isValid,
    expiresAt,
    expiresIn,
    isExpiringSoon,
  };
}

/**
 * Ottiene informazioni sui token correnti
 */
export function getTokenInfo(): {
  accessToken: TokenInfo;
  refreshToken: TokenInfo;
} {
  if (typeof window === 'undefined') {
    return {
      accessToken: { isValid: false, expiresAt: null, expiresIn: null, isExpiringSoon: false },
      refreshToken: { isValid: false, expiresAt: null, expiresIn: null, isExpiringSoon: false },
    };
  }

  const accessToken = localStorage.getItem('accessToken');
  const refreshToken = localStorage.getItem('refreshToken');

  return {
    accessToken: analyzeToken(accessToken),
    refreshToken: analyzeToken(refreshToken),
  };
}

/**
 * Formatta il tempo rimanente in formato leggibile
 */
export function formatTimeRemaining(ms: number | null): string {
  if (ms === null || ms <= 0) {
    return 'Scaduto';
  }

  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}g ${hours % 24}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

/**
 * Log dettagliato dei token (solo in sviluppo)
 */
export function logTokenStatus(): void {
  if (process.env.NODE_ENV !== 'development') {
    return;
  }

  const { accessToken, refreshToken } = getTokenInfo();

  console.group('🔐 Token Status');
  console.log('Access Token:', {
    valid: accessToken.isValid,
    expiresAt: accessToken.expiresAt?.toLocaleString(),
    expiresIn: formatTimeRemaining(accessToken.expiresIn),
    expiringSoon: accessToken.isExpiringSoon,
  });
  console.log('Refresh Token:', {
    valid: refreshToken.isValid,
    expiresAt: refreshToken.expiresAt?.toLocaleString(),
    expiresIn: formatTimeRemaining(refreshToken.expiresIn),
    expiringSoon: refreshToken.isExpiringSoon,
  });
  console.groupEnd();
}

