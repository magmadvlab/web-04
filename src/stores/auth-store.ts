import { create } from "zustand";
import { persist } from "zustand/middleware";
import { authService } from "@/lib/auth";
import { analyzeToken } from "@/lib/token-utils";
import { normalizeRole } from "@/lib/role-utils";
import type { User, LoginRequest, RegisterRequest } from "@/types/api";

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  _hasHydrated: boolean;
  login: (credentials: LoginRequest, role?: string) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => void;
  setUser: (user: User | null) => void;
  refreshToken: () => Promise<void>;
}

// WEB-01: i token sono ora in cookie (via /api/auth/session).
// localStorage è mantenuto SOLO per legacy/fallback — non è più la fonte primaria.
const LEGACY_ACCESS_TOKEN_KEY = "accessToken";
const LEGACY_TOKEN_KEY = "token";
const LEGACY_REFRESH_TOKEN_KEY = "refreshToken";

/**
 * WEB-01: imposta i cookie di sessione chiamando la Next.js API route.
 * - accessToken → cookie SameSite=Strict (leggibile da axios per Authorization header)
 * - refreshToken → cookie HttpOnly (invisibile a JavaScript, protetto da XSS)
 */
const setSessionCookies = async (accessToken: string, refreshToken: string): Promise<void> => {
  if (typeof window === "undefined") return;
  try {
    await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken, refreshToken }),
    });
  } catch {
    // Fallback silenzioso — il token rimane in memoria per axios
  }
};

/**
 * WEB-01: cancella i cookie di sessione.
 */
const clearSessionCookies = async (): Promise<void> => {
  if (typeof window === "undefined") return;
  try {
    await fetch("/api/auth/session", { method: "DELETE" });
  } catch {
    // Fallback silenzioso
  }
};

/** Pulisce i token legacy da localStorage */
const clearLegacyLocalStorage = () => {
  if (typeof window === "undefined") return;
  localStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY);
  localStorage.removeItem(LEGACY_TOKEN_KEY);
  localStorage.removeItem(LEGACY_REFRESH_TOKEN_KEY);
  localStorage.removeItem("auth-storage");
};

const normalizeUserRole = (role: string | undefined | null): string | undefined | null => {
  if (!role) return role;
  return normalizeRole(role);
};

const normalizeUser = (user: User | null): User | null => {
  if (!user) return null;
  const normalizedRole = normalizeUserRole(user.ruolo);
  if (normalizedRole === user.ruolo) return user;
  return { ...user, ruolo: normalizedRole as User["ruolo"] };
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      _hasHydrated: false,

      login: async (credentials: LoginRequest, role?: string) => {
        set({ isLoading: true });
        try {
          const response = await authService.login(credentials, role);

          // WEB-01: salva in cookie (non localStorage)
          await setSessionCookies(response.accessToken, response.refreshToken);

          // Mantieni in localStorage solo per compatibilità con gli interceptor axios
          // che leggono ancora da lì durante la transizione — verrà rimosso in WEB-01 completo
          if (typeof window !== "undefined") {
            localStorage.setItem(LEGACY_ACCESS_TOKEN_KEY, response.accessToken);
            localStorage.setItem(LEGACY_TOKEN_KEY, response.accessToken);
            localStorage.setItem(LEGACY_REFRESH_TOKEN_KEY, response.refreshToken);
          }

          authService.setTokens(response.accessToken, response.refreshToken);
          set({
            user: normalizeUser(response.user as User),
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error) {
          set({ user: null, isAuthenticated: false, isLoading: false });
          clearLegacyLocalStorage();
          await clearSessionCookies();
          throw error;
        }
      },

      register: async (data: RegisterRequest) => {
        set({ isLoading: true });
        try {
          const response = await authService.register(data);
          await setSessionCookies(response.accessToken, response.refreshToken);
          if (typeof window !== "undefined") {
            localStorage.setItem(LEGACY_ACCESS_TOKEN_KEY, response.accessToken);
            localStorage.setItem(LEGACY_TOKEN_KEY, response.accessToken);
            localStorage.setItem(LEGACY_REFRESH_TOKEN_KEY, response.refreshToken);
          }
          authService.setTokens(response.accessToken, response.refreshToken);
          set({
            user: normalizeUser(response.user as User),
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      logout: () => {
        set({ user: null, isAuthenticated: false, isLoading: false });
        clearLegacyLocalStorage();
        // WEB-01: cancella anche i cookie di sessione
        clearSessionCookies();
        authService.logout();
      },

      setUser: (user: User | null) => {
        const normalizedUser = normalizeUser(user);
        set({ user: normalizedUser, isAuthenticated: !!normalizedUser });
      },

      refreshToken: async () => {
        try {
          const tokens = await authService.refreshToken();
          await setSessionCookies(tokens.accessToken, tokens.refreshToken);
          if (typeof window !== "undefined") {
            localStorage.setItem(LEGACY_ACCESS_TOKEN_KEY, tokens.accessToken);
            localStorage.setItem(LEGACY_TOKEN_KEY, tokens.accessToken);
            localStorage.setItem(LEGACY_REFRESH_TOKEN_KEY, tokens.refreshToken);
          }
          authService.setTokens(tokens.accessToken, tokens.refreshToken);
        } catch (error) {
          set({ user: null, isAuthenticated: false });
          throw error;
        }
      },
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
      onRehydrateStorage: () => () => {
        // Segna l'idratazione come completata — usato da PazienteLayout (e altri)
        // per evitare redirect prematuri prima che persist abbia letto localStorage.
        useAuthStore.setState({ _hasHydrated: true });

        if (typeof window === "undefined") return;

        const currentUser = useAuthStore.getState().user;
        const normalizedUser = normalizeUser(currentUser);
        if (normalizedUser?.ruolo !== currentUser?.ruolo) {
          useAuthStore.setState({ user: normalizedUser, isAuthenticated: !!normalizedUser });
        }

        const accessToken = localStorage.getItem(LEGACY_ACCESS_TOKEN_KEY) || localStorage.getItem(LEGACY_TOKEN_KEY);
        const refreshToken = localStorage.getItem(LEGACY_REFRESH_TOKEN_KEY);
        if (!accessToken) {
          useAuthStore.setState({ user: null, isAuthenticated: false, isLoading: false });
          return;
        }
        const accessInfo = analyzeToken(accessToken);
        if (!accessInfo.isValid) {
          const refreshInfo = analyzeToken(refreshToken);
          if (refreshInfo.isValid) {
            localStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY);
            localStorage.removeItem(LEGACY_TOKEN_KEY);
            useAuthStore.setState({ isAuthenticated: false, isLoading: false });
            return;
          }
          clearLegacyLocalStorage();
          clearSessionCookies();
          useAuthStore.setState({ user: null, isAuthenticated: false, isLoading: false });
          return;
        }

        // Token valido: ripristina l'header Authorization di axios.
        // Fondamentale su hard reload / nuova sessione: il modulo axios viene
        // re-inizializzato senza api.defaults.headers.common.Authorization,
        // quindi tutte le chiamate API andrebbero senza token → 401.
        authService.setTokens(accessToken, refreshToken ?? "");
      },
    }
  )
);
