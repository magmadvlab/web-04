import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import type { ApiResponse } from "@/types/api";
import { showErrorToast } from "./error-toast";
import { logTokenStatus, getTokenInfo, formatTimeRemaining } from "./token-utils";
import { useAuthStore } from "@/stores/auth-store";
import {
  getRefreshEndpointForRole,
  buildRefreshEndpointCandidates,
  getRoleFromPathname,
} from "@/lib/role-utils";

// URL di produzione dell'api-paziente su Railway
// Usato come fallback quando NEXT_PUBLIC_API_URL non è configurata
const PRODUCTION_API_FALLBACK = 'https://api-01-production.up.railway.app';

// Determina l'API URL in base all'ambiente
const getApiUrl = (): string => {
  // Usa sempre la variabile d'ambiente configurata
  if (process.env.NEXT_PUBLIC_API_URL) {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL;
    // Assicura che l'URL finisca con /api
    return baseUrl.endsWith('/api') ? baseUrl : `${baseUrl}/api`;
  }

  // Fallback a localhost solo in sviluppo locale
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:3000/api';
  }

  // In produzione senza NEXT_PUBLIC_API_URL: usa fallback e logga il warning
  if (typeof window !== 'undefined') {
    console.warn('[api.ts] NEXT_PUBLIC_API_URL non configurata: uso fallback', PRODUCTION_API_FALLBACK);
  }
  return `${PRODUCTION_API_FALLBACK}/api`;
};

// Crea l'istanza axios con baseURL dinamico
const createApiInstance = () => {
  const baseURL = getApiUrl();

  // Log dell'URL in uso (solo in development o nel browser)
  if (typeof window !== 'undefined') {
    console.log('🔗 API URL:', baseURL);
  }

  return axios.create({
    baseURL,
    headers: {
      "Content-Type": "application/json",
    },
  });
};

// Create axios instance
export const api = createApiInstance();

// Export API_URL for use in other parts of the app
export const API_URL = getApiUrl();
const ACCESS_TOKEN_KEY = "accessToken";
const LEGACY_ACCESS_TOKEN_KEY = "token";
const REFRESH_TOKEN_KEY = "refreshToken";

const AUTH_PATHS = [
  "/auth/login",
  "/auth/register",
  "/auth/refresh",
  "/auth/medico/login",
  "/auth/medico/refresh",
  "/auth/farmacia/login",
  "/auth/farmacia/refresh",
  "/auth/delivery/login",
  "/auth/delivery/refresh",
  "/auth/specialista/login",
  "/auth/specialista/refresh",
  "/auth/laboratorio/login",
  "/auth/laboratorio/refresh",
  "/auth/admin/login",
  "/auth/admin/refresh",
  "/auth/professionisti/login",
  "/auth/professionisti/refresh",
  "/auth/professionisti/register",
  "/auth/fornitori/login",
  "/auth/fornitori/refresh",
  "/auth/fornitori/register",
  "/laboratori/dashboard/login",
];

const normalizeRequestPath = (url: string): string => {
  if (!url) {
    return "";
  }

  try {
    const parsed = new URL(url, API_URL);
    return parsed.pathname.replace(/^\/api/, "");
  } catch {
    return url.replace(/^https?:\/\/[^/]+/, "").replace(/^\/api/, "").split("?")[0] || "";
  }
};

const isAuthRequest = (url: string): boolean => {
  const path = normalizeRequestPath(url);
  if (!path) {
    return false;
  }

  // Match robusto: evita refresh/token wait su qualsiasi endpoint auth.
  if (path === "/auth" || path.startsWith("/auth/")) {
    return true;
  }

  // Copre endpoint login/register non sotto /auth (es. /laboratori/dashboard/login)
  if (/(^|\/)(login|register|refresh)\/?$/.test(path)) {
    return true;
  }

  return AUTH_PATHS.some((authPath) => path.includes(authPath));
};

const isExpectedSpecialistaPatientAccess403 = (
  url: string,
  userRole: string | null,
): boolean => {
  const role = (userRole || "").toLowerCase();
  if (!role.includes("specialista")) {
    return false;
  }

  const path = normalizeRequestPath(url);
  if (!path.startsWith("/specialista/pazienti/")) {
    return false;
  }

  return (
    /\/dashboard$/.test(path) ||
    /\/visite$/.test(path) ||
    /\/prescrizioni$/.test(path) ||
    /\/esami$/.test(path) ||
    /\/referti-dettaglio(?:\/\d+)?$/.test(path)
  );
};

const hasUsableToken = (token: string | null | undefined): token is string =>
  typeof token === "string" &&
  token.trim().length > 0 &&
  token !== "null" &&
  token !== "undefined";

const getStoredAccessToken = (): string | null => {
  const primary = localStorage.getItem(ACCESS_TOKEN_KEY);
  if (hasUsableToken(primary)) {
    return primary;
  }

  const legacy = localStorage.getItem(LEGACY_ACCESS_TOKEN_KEY);
  if (hasUsableToken(legacy)) {
    localStorage.setItem(ACCESS_TOKEN_KEY, legacy);
    return legacy;
  }

  return null;
};

const persistAccessToken = (token: string) => {
  localStorage.setItem(ACCESS_TOKEN_KEY, token);
  localStorage.setItem(LEGACY_ACCESS_TOKEN_KEY, token);
};

const clearStoredAccessToken = () => {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY);
};

const decodeJwtPayload = (token: string): Record<string, any> | null => {
  if (!hasUsableToken(token)) {
    return null;
  }

  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      return null;
    }
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
};

const waitForAccessToken = async (timeoutMs = 3000, intervalMs = 25): Promise<string | null> => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const token = getStoredAccessToken();
    if (hasUsableToken(token)) {
      return token;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return null;
};

const readRoleFromToken = (): string | null => {
  const accessPayload = decodeJwtPayload(getStoredAccessToken() || "");
  if (typeof accessPayload?.ruolo === "string") {
    return accessPayload.ruolo;
  }
  if (typeof accessPayload?.role === "string") {
    return accessPayload.role;
  }

  const refreshPayload = decodeJwtPayload(localStorage.getItem(REFRESH_TOKEN_KEY) || "");
  if (typeof refreshPayload?.ruolo === "string") {
    return refreshPayload.ruolo;
  }
  if (typeof refreshPayload?.role === "string") {
    return refreshPayload.role;
  }

  return null;
};

// WEB-07: delega a role-utils (fonte unica di verità)
const readRoleFromPathname = (): string | null => {
  if (typeof window === "undefined") return null;
  return getRoleFromPathname(window.location.pathname);
};

const readUserRole = (): string | null => {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const authStorage = localStorage.getItem("auth-storage");
    if (authStorage) {
      const parsed = JSON.parse(authStorage);
      const roleFromStore = parsed?.state?.user?.ruolo;
      if (typeof roleFromStore === "string" && roleFromStore.trim().length > 0) {
        return roleFromStore;
      }
    }
  } catch {
    // ignore parse errors
  }
  return readRoleFromToken() || readRoleFromPathname();
};

// WEB-07: delega a role-utils (fonte unica di verità)
const getRefreshPathForRole = (rawRole: string | null): string =>
  getRefreshEndpointForRole(rawRole);

// WEB-07: delega a role-utils (fonte unica di verità)
const buildRefreshPathCandidates = (): string[] =>
  buildRefreshEndpointCandidates({
    roleFromStore: readUserRole(),
    roleFromToken: readRoleFromToken(),
    roleFromPath: readRoleFromPathname(),
  });

const requestTokenRefresh = async (
  refreshToken: string,
): Promise<{ accessToken: string; refreshToken: string } | null> => {
  const refreshCandidates = buildRefreshPathCandidates();
  let lastError: any = null;

  for (const refreshPath of refreshCandidates) {
    try {
      const response = await axios.post<
        ApiResponse<{ accessToken: string; refreshToken: string }> | { accessToken: string; refreshToken: string }
      >(`${API_URL}${refreshPath}`, {}, {
        headers: {
          Authorization: `Bearer ${refreshToken}`,
        },
      });

      const payload = "data" in response.data ? response.data.data : response.data;
      if (!hasUsableToken(payload?.accessToken) || !hasUsableToken(payload?.refreshToken)) {
        continue;
      }

      return {
        accessToken: payload.accessToken,
        refreshToken: payload.refreshToken,
      };
    } catch (error: any) {
      lastError = error;
      const status = Number(error?.response?.status || 0);
      if (status === 401 || status === 404 || status === 405) {
        continue;
      }
      throw error;
    }
  }

  if (lastError) {
    throw lastError;
  }

  return null;
};

const tryRefreshAccessToken = async (): Promise<string | null> => {
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!hasUsableToken(refreshToken)) {
    return null;
  }

  try {
    const refreshed = await requestTokenRefresh(refreshToken);
    if (!refreshed) {
      return null;
    }

    persistAccessToken(refreshed.accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshed.refreshToken);
    return refreshed.accessToken;
  } catch {
    return null;
  }
};

// Request interceptor - Add token to requests
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    if (typeof window !== "undefined") {
      const url = config.url || "";
      if (isAuthRequest(url)) {
        return config;
      }

      let token = getStoredAccessToken();

      // If no token immediately available, wait for it
      if (!hasUsableToken(token)) {
        console.debug(`🔍 No immediate token found for ${url}, waiting...`);
        token = await waitForAccessToken();
        if (token) {
          console.debug(`✅ Token acquired for ${url} after waiting`);
        }
      }

      // If still missing, try one proactive refresh before sending an unauthenticated request
      if (!hasUsableToken(token)) {
        token = await tryRefreshAccessToken();
        if (token) {
          console.debug(`✅ Access token refreshed for ${url}`);
        } else {
          console.warn(`❌ Failed to acquire token for ${url} after timeout`);
        }
      }

      if (hasUsableToken(token) && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;

        // Log token status in development mode
        if (process.env.NODE_ENV === "development") {
          console.debug("🔐 Auth header set for request:", url);
          const tokenInfo = getTokenInfo();
          if (tokenInfo.accessToken.isExpiringSoon) {
            console.warn("⚠️ Access token sta per scadere:", formatTimeRemaining(tokenInfo.accessToken.expiresIn));
          }
        }
      } else {
        // Log warning if no token is available
        if (process.env.NODE_ENV === "development") {
          console.warn("⚠️ Nessun access token disponibile per la richiesta:", config.url);
        }
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - Handle token refresh
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: any) => void;
  reject: (error?: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Helper function to get user role from localStorage
const getUserRole = (): string | null => {
  return readUserRole();
};

api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    const status = error.response?.status;

    // If 401 and not already retrying
    if (status === 401 && !originalRequest._retry) {
      // Don't retry if it's already an auth path (login/refresh failed)
      const url = originalRequest.url || "";
      if (isAuthRequest(url)) {
        return Promise.reject(error);
      }
      // Log token status in development mode
      if (process.env.NODE_ENV === 'development') {
        console.group('🔄 Tentativo refresh token');
        logTokenStatus();
        console.log('Richiesta originale:', originalRequest.url);
        console.groupEnd();
      }

      if (isRefreshing) {
        // Queue this request
        if (process.env.NODE_ENV === 'development') {
          console.log('⏳ Refresh già in corso, metto in coda la richiesta:', originalRequest.url);
        }
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            return api(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
        if (!refreshToken) {
          if (process.env.NODE_ENV === 'development') {
            console.error('❌ Nessun refresh token disponibile');
          }
          throw new Error("No refresh token");
        }

        // Verifica se il refresh token è ancora valido
        const tokenInfo = getTokenInfo();
        if (!tokenInfo.refreshToken.isValid) {
          if (process.env.NODE_ENV === 'development') {
            console.error('❌ Refresh token scaduto:', formatTimeRemaining(tokenInfo.refreshToken.expiresIn));
          }
          throw new Error("Refresh token expired");
        }

        if (process.env.NODE_ENV === 'development') {
          console.log('🔄 Chiamata endpoint refresh token...');
        }

        const refreshed = await requestTokenRefresh(refreshToken);
        if (!refreshed) {
          throw new Error("Refresh failed");
        }

        const { accessToken, refreshToken: newRefreshToken } = refreshed;
        persistAccessToken(accessToken);
        localStorage.setItem(REFRESH_TOKEN_KEY, newRefreshToken);

        if (process.env.NODE_ENV === 'development') {
          console.log('✅ Token refreshato con successo');
          logTokenStatus();
        }

        processQueue(null, accessToken);

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        }

        isRefreshing = false;
        return api(originalRequest);
      } catch (refreshError: any) {
        processQueue(refreshError, null);
        isRefreshing = false;

        // Log dettagliato dell'errore in development
        if (process.env.NODE_ENV === 'development') {
          console.group('❌ Errore durante refresh token');
          console.error('Errore:', refreshError);
          if (refreshError.response) {
            console.error('Status:', refreshError.response.status);
            console.error('Data:', refreshError.response.data);
          }
          logTokenStatus();
          console.groupEnd();
        }

        // Clear tokens and update auth store (layout handles redirect)
        if (typeof window !== "undefined") {
          const roleBeforeClear = readUserRole() || readRoleFromPathname();
          clearStoredAccessToken();
          localStorage.removeItem(REFRESH_TOKEN_KEY);
          localStorage.removeItem("auth-storage");

          if (process.env.NODE_ENV === 'development') {
            console.log('🔐 Sessione scaduta, aggiornamento stato auth...');
          }

          // Update zustand store → layout useEffect detects isAuthenticated=false → redirects to /login
          // This avoids hard redirect that breaks Promise.allSettled and other async patterns
          useAuthStore.setState({ user: null, isAuthenticated: false, isLoading: false });

          if (!window.location.pathname.startsWith("/login")) {
            const roleParam =
              typeof roleBeforeClear === "string" && roleBeforeClear.trim().length > 0
                ? `?role=${encodeURIComponent(roleBeforeClear)}`
                : "";
            window.location.replace(`/login${roleParam}`);
          }
        }

        return Promise.reject(refreshError);
      }
    }

    // Handle 403 for delivery/rider: api-04 può restituire 403 invece di 401
    // per token scaduti quando il role-guard viene eseguito prima del JWT guard.
    if (status === 403 && !originalRequest._retry) {
      const userRole = getUserRole();
      const url = originalRequest.url || '';
      const isDeliveryUser =
        userRole != null &&
        (userRole.toLowerCase().includes('delivery') || userRole.toLowerCase().includes('rider'));

      if (isDeliveryUser && !isAuthRequest(url)) {
        if (isRefreshing) {
          return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          })
            .then((token) => {
              if (originalRequest.headers) {
                originalRequest.headers.Authorization = `Bearer ${token}`;
              }
              return api(originalRequest);
            })
            .catch((err) => Promise.reject(err));
        }

        originalRequest._retry = true;
        isRefreshing = true;

        const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
        if (hasUsableToken(refreshToken)) {
          try {
            const refreshed = await requestTokenRefresh(refreshToken!);
            if (refreshed) {
              persistAccessToken(refreshed.accessToken);
              localStorage.setItem(REFRESH_TOKEN_KEY, refreshed.refreshToken);
              processQueue(null, refreshed.accessToken);
              if (originalRequest.headers) {
                originalRequest.headers.Authorization = `Bearer ${refreshed.accessToken}`;
              }
              isRefreshing = false;
              return api(originalRequest);
            }
          } catch {
            // Refresh fallito: prosegui con la gestione normale del 403
          }
          processQueue(null, null);
          isRefreshing = false;
        }
      }
    }

    // Handle 403 errors: don't show toast for admin users (normal behavior)
    if (status === 403) {
      const userRole = getUserRole();
      if (isExpectedSpecialistaPatientAccess403(originalRequest.url || "", userRole)) {
        return Promise.reject(error);
      }
      // If user is admin, 403 errors are expected (normal access control)
      // Don't show toast to avoid noise
      if (userRole === "admin") {
        // Silently reject for admin - this is normal behavior
        return Promise.reject(error);
      }
      // For non-admin users, show error toast
      showErrorToast(error, "Accesso negato");
      return Promise.reject(error);
    }

    // Handle other client errors (400, 404, 422, etc.) - show toast
    if (status && status >= 400 && status < 500) {
      showErrorToast(error, "Errore");
      return Promise.reject(error);
    }

    // Handle server errors (500+) - show toast
    if (status && status >= 500) {
      showErrorToast(error, "Errore del server");
      return Promise.reject(error);
    }

    // Handle network errors (no response)
    if (!error.response) {
      showErrorToast(new Error("Impossibile connettersi al server. Verifica la connessione internet."), "Errore di connessione");
      return Promise.reject(error);
    }

    return Promise.reject(error);
  }
);

export default api;
