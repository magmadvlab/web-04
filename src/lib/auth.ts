import api from "./api";
import { getErrorMessage } from "@/hooks/useErrorHandler";
import { isAxiosError } from "axios";
import {
  getLoginEndpointForRole,
  ALL_LOGIN_ENDPOINTS,
} from "@/lib/role-utils";
import type {
  LoginRequest,
  RegisterRequest,
  AuthResponse,
  ApiResponse,
} from "@/types/api";

const ACCESS_TOKEN_KEY = "accessToken";
const LEGACY_ACCESS_TOKEN_KEY = "token";
const REFRESH_TOKEN_KEY = "refreshToken";


const LOGIN_RETRYABLE_STATUS = new Set([502, 503, 504]);

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isTransientLoginError = (error: unknown): boolean => {
  if (!isAxiosError(error)) {
    return false;
  }

  const status = error.response?.status;
  if (typeof status === "number" && LOGIN_RETRYABLE_STATUS.has(status)) {
    return true;
  }

  if (!error.response) {
    return true;
  }

  const message = `${error.message ?? ""} ${JSON.stringify(error.response?.data ?? "")}`.toLowerCase();
  return (
    message.includes("unexpected eof while reading") ||
    message.includes("network error") ||
    message.includes("timeout")
  );
};

const isInvalidCredentialsError = (error: unknown): boolean => {
  if (!isAxiosError(error)) {
    return false;
  }

  return error.response?.status === 401;
};

export const authService = {
  async login(credentials: LoginRequest, role?: string): Promise<AuthResponse> {
    const primaryEndpoint = getLoginEndpointForRole(role);
    const fallbackEndpoints = !role ? ALL_LOGIN_ENDPOINTS : [];
    const endpointsToTry = [primaryEndpoint, ...fallbackEndpoints];

    let lastError: unknown = null;

    for (let endpointIndex = 0; endpointIndex < endpointsToTry.length; endpointIndex += 1) {
      const endpoint = endpointsToTry[endpointIndex];
      const isLastEndpoint = endpointIndex === endpointsToTry.length - 1;
      const maxAttempts = 3;

      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
          const response = await api.post<ApiResponse<AuthResponse> | AuthResponse>(
            endpoint,
            credentials
          );
          const payload =
            "data" in response.data ? response.data.data : response.data;
          return payload;
        } catch (error: unknown) {
          lastError = error;
          if (attempt < maxAttempts && isTransientLoginError(error)) {
            await wait(250 * attempt);
            continue;
          }

          // When no role is selected, try other role-specific endpoints
          // only after a clean credentials failure on the current endpoint.
          if (
            !role &&
            !isLastEndpoint &&
            isInvalidCredentialsError(error) &&
            !isTransientLoginError(error)
          ) {
            break;
          }

          if (isLastEndpoint) {
            break;
          }

          // For non-401 errors, keep the first failing response to avoid hiding
          // infrastructure/config problems behind endpoint fallback behavior.
          if (!isInvalidCredentialsError(error)) {
            const message = getErrorMessage(error);
            throw new Error(message || "Errore durante il login");
          }

          break;
        }
      }
    }

    const message = getErrorMessage(lastError);
    throw new Error(message || "Errore durante il login");
  },

  async register(data: RegisterRequest): Promise<AuthResponse> {
    const response = await api.post<ApiResponse<AuthResponse> | AuthResponse>(
      "/auth/register",
      data
    );
    const payload =
      "data" in response.data ? response.data.data : response.data;
    return payload;
  },

  async refreshToken(): Promise<{ accessToken: string; refreshToken: string }> {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (!refreshToken) {
      throw new Error("No refresh token available");
    }

    let endpoint = "/auth/refresh";
    try {
      const authStorage = localStorage.getItem("auth-storage");
      const role = authStorage
        ? JSON.parse(authStorage)?.state?.user?.ruolo?.toLowerCase?.()
        : "";
      if (role?.includes("professionista")) {
        endpoint = "/auth/professionisti/refresh";
      } else if (role?.includes("fornitore")) {
        endpoint = "/auth/fornitori/refresh";
      } else if (role?.includes("specialista")) {
        endpoint = "/auth/specialista/refresh";
      } else if (role?.includes("medico")) {
        endpoint = "/auth/medico/refresh";
      } else if (role?.includes("farmacia") || role?.includes("farmacista")) {
        endpoint = "/auth/farmacia/refresh";
      } else if (role?.includes("delivery") || role?.includes("rider")) {
        endpoint = "/auth/delivery/refresh";
      } else if (role?.includes("admin")) {
        endpoint = "/auth/admin/refresh";
      } else if (role?.includes("laboratorio")) {
        endpoint = "/auth/laboratorio/refresh";
      }
    } catch {
      // fallback endpoint already set
    }

    const response = await api.post<
      ApiResponse<{ accessToken: string; refreshToken: string }> | AuthResponse
    >(endpoint, {}, {
      headers: {
        Authorization: `Bearer ${refreshToken}`,
      },
    });
    const payload =
      "data" in response.data ? response.data.data : response.data;
    return {
      accessToken: payload.accessToken,
      refreshToken: payload.refreshToken,
    };
  },

  logout(): void {
    if (typeof window !== "undefined") {
      localStorage.removeItem(ACCESS_TOKEN_KEY);
      localStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
      delete api.defaults.headers.common.Authorization;
      localStorage.removeItem("auth-storage");
      // WEB-01: cancella anche i cookie di sessione
      fetch("/api/auth/session", { method: "DELETE" }).catch(() => {});
      window.location.href = "/login";
    }
  },

  getToken(): string | null {
    if (typeof window !== "undefined") {
      return localStorage.getItem(ACCESS_TOKEN_KEY) || localStorage.getItem(LEGACY_ACCESS_TOKEN_KEY);
    }
    return null;
  },

  getRefreshToken(): string | null {
    if (typeof window !== "undefined") {
      return localStorage.getItem(REFRESH_TOKEN_KEY);
    }
    return null;
  },

  setTokens(accessToken: string, refreshToken: string): void {
    if (typeof window !== "undefined") {
      localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
      localStorage.setItem(LEGACY_ACCESS_TOKEN_KEY, accessToken);
      localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
      api.defaults.headers.common.Authorization = `Bearer ${accessToken}`;
    }
  },
};
