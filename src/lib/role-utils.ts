/**
 * Modulo centralizzato per il mapping ruolo → endpoint.
 * WEB-07: eliminata la logica duplicata presente in auth.ts, api.ts e auth-store.ts.
 *
 * Fonte unica di verità per:
 * - endpoint di login per ruolo
 * - endpoint di refresh per ruolo
 * - normalizzazione degli alias di ruolo
 */

/** Alias canonici: alcuni portali usano nomi brevi */
export const ROLE_ALIASES: Record<string, string> = {
  professionista: "professionista_sanitario",
  fornitore: "fornitore_sanitario",
};

/** Normalizza un ruolo applicando gli alias */
export const normalizeRole = (role: string | undefined | null): string | undefined | null => {
  if (!role) return role;
  return ROLE_ALIASES[role.toLowerCase()] ?? role;
};

/**
 * Ritorna la dashboard corretta per un ruolo utente.
 * Accetta sia il ruolo canonico sia alcuni alias legacy.
 */
export const getDashboardPathForRole = (
  rawRole: string | undefined | null,
): string => {
  const role = normalizeRole(rawRole)?.toLowerCase();

  if (role === "paziente") return "/paziente/dashboard";
  if (role === "medico") return "/medico/dashboard";
  if (role === "specialista") return "/specialista/dashboard";
  if (role === "farmacista" || role === "farmacia") return "/farmacia/dashboard";
  if (role === "rider" || role === "delivery") return "/delivery/dashboard";
  if (role === "professionista_sanitario" || role === "professionista") return "/professionista/dashboard";
  if (role === "fornitore_sanitario" || role === "fornitore") return "/fornitore/dashboard";
  if (role === "admin") return "/admin/dashboard";
  if (role === "laboratorio") return "/laboratorio/dashboard";

  return "/dashboard";
};

/**
 * Ritorna l'endpoint di login corretto per il ruolo specificato.
 * Se nessun ruolo è specificato, ritorna l'endpoint generico /auth/login.
 */
export const getLoginEndpointForRole = (role?: string): string => {
  const r = (role ?? "").toLowerCase();
  if (r === "professionista_sanitario" || r === "professionista") return "/auth/professionisti/login";
  if (r === "fornitore_sanitario" || r === "fornitore")             return "/auth/fornitori/login";
  if (r === "specialista")                                          return "/auth/specialista/login";
  if (r === "medico")                                               return "/auth/medico/login";
  if (r === "farmacista" || r === "farmacia")                       return "/auth/farmacia/login";
  if (r === "rider" || r === "delivery")                            return "/auth/delivery/login";
  if (r === "admin")                                                return "/auth/admin/login";
  if (r === "laboratorio")                                          return "/auth/laboratorio/login";
  return "/auth/login";
};

/**
 * Ritorna l'endpoint di refresh token corretto per il ruolo specificato.
 * Usato in api.ts e auth.ts per refresh automatico.
 */
export const getRefreshEndpointForRole = (rawRole: string | null | undefined): string => {
  const role = (rawRole ?? "").toLowerCase();
  if (role.includes("professionista")) return "/auth/professionisti/refresh";
  if (role.includes("fornitore"))      return "/auth/fornitori/refresh";
  if (role.includes("specialista"))    return "/auth/specialista/refresh";
  if (role.includes("medico"))         return "/auth/medico/refresh";
  if (role.includes("farmacia") || role.includes("farmacista")) return "/auth/farmacia/refresh";
  if (role.includes("delivery") || role.includes("rider"))      return "/auth/delivery/refresh";
  if (role.includes("admin"))          return "/auth/admin/refresh";
  if (role.includes("laboratorio"))    return "/auth/laboratorio/refresh";
  return "/auth/refresh";
};

/**
 * Ritorna la lista prioritizzata di endpoint di refresh da provare,
 * basandosi su ruolo dello store, ruolo dal token e percorso URL corrente.
 */
export const buildRefreshEndpointCandidates = (params: {
  roleFromStore: string | null;
  roleFromToken: string | null;
  roleFromPath: string | null;
}): string[] => {
  const candidates: string[] = [];
  const push = (path: string) => {
    if (!candidates.includes(path)) candidates.push(path);
  };
  push(getRefreshEndpointForRole(params.roleFromStore));
  if (params.roleFromToken) push(getRefreshEndpointForRole(params.roleFromToken));
  if (params.roleFromPath)  push(getRefreshEndpointForRole(params.roleFromPath));
  push("/auth/refresh"); // fallback universale
  return candidates;
};

/**
 * Deriva il ruolo dal percorso URL corrente (client-side only).
 */
export const getRoleFromPathname = (pathname: string): string | null => {
  const p = pathname.toLowerCase();
  if (p.startsWith("/specialista"))   return "specialista";
  if (p.startsWith("/medico"))        return "medico";
  if (p.startsWith("/farmacia"))      return "farmacia";
  if (p.startsWith("/delivery") || p.startsWith("/rider")) return "delivery";
  if (p.startsWith("/laboratorio"))   return "laboratorio";
  if (p.startsWith("/admin"))         return "admin";
  if (p.startsWith("/professionista")) return "professionista_sanitario";
  if (p.startsWith("/fornitore"))     return "fornitore_sanitario";
  if (p.startsWith("/paziente") || p.startsWith("/dashboard")) return "paziente";
  return null;
};

/** Tutti gli endpoint di login noti (per il fallback multi-ruolo) */
export const ALL_LOGIN_ENDPOINTS: string[] = [
  "/auth/medico/login",
  "/auth/specialista/login",
  "/auth/farmacia/login",
  "/auth/delivery/login",
  "/auth/professionisti/login",
  "/auth/fornitori/login",
  "/auth/admin/login",
  "/auth/laboratorio/login",
];
