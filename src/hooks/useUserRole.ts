import { useAuthStore } from "@/stores/auth-store";
import type { User } from "@/types/api";

export type UserRole = User["ruolo"] | null;

/**
 * Hook per ottenere il ruolo dell'utente corrente
 * @returns Il ruolo dell'utente o null se non autenticato
 */
export function useUserRole(): UserRole {
  const user = useAuthStore((state) => state.user);
  return user?.ruolo ?? null;
}

/**
 * Hook per verificare se l'utente ha un ruolo specifico
 * @param role Il ruolo da verificare
 * @returns true se l'utente ha il ruolo specificato
 */
export function useHasRole(role: User["ruolo"]): boolean {
  const userRole = useUserRole();
  return userRole === role;
}

/**
 * Hook per verificare se l'utente è admin
 * @returns true se l'utente è admin
 */
export function useIsAdmin(): boolean {
  return useHasRole("admin");
}


