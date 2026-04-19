"use client";

import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";
import { Bell, LogOut } from "lucide-react";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type HeaderNotification = {
  id: string;
  title?: string;
  body?: string;
  createdAt?: string;
  readAt?: string | null;
  actionUrl?: string;
};

type RoleBellConfig = {
  endpoint?: string;
  params?: Record<string, any>;
  actionUrl: string;
  title: string;
};

type RoleBellSummary = {
  count: number;
  notifications: HeaderNotification[];
};

const unwrapApiData = (payload: any) => {
  if (payload && typeof payload === "object" && "data" in payload) {
    return payload.data;
  }
  return payload;
};

const extractItems = (payload: any) => {
  const unwrapped = unwrapApiData(payload);
  if (Array.isArray(unwrapped)) return unwrapped;
  if (Array.isArray(unwrapped?.data)) return unwrapped.data;
  if (Array.isArray(unwrapped?.items)) return unwrapped.items;
  if (Array.isArray(unwrapped?.richieste)) return unwrapped.richieste;
  if (Array.isArray(unwrapped?.notifications)) return unwrapped.notifications;
  return [];
};

const getAssignmentRiderCount = (assignment: any) => {
  const riders = new Set(
    (Array.isArray(assignment?.ordini) ? assignment.ordini : [])
      .map((ordine: any) => ordine?.rider?.id)
      .filter((id: unknown) => Number.isFinite(Number(id))),
  );
  return riders.size;
};

const getBatchOrdersCount = (batch: any) => {
  if (!batch) return 0;
  if (Array.isArray(batch.ordini)) return batch.ordini.length;
  if (Number.isFinite(Number(batch.ordiniTotali))) return Number(batch.ordiniTotali);
  if (Number.isFinite(Number(batch.ordiniCount))) return Number(batch.ordiniCount);
  if (Number.isFinite(Number(batch?._count?.ordini))) return Number(batch._count.ordini);
  return 0;
};

const buildRoleNotification = (
  id: string,
  title: string,
  body: string,
  actionUrl: string,
): HeaderNotification => ({
  id,
  title,
  body,
  createdAt: new Date().toISOString(),
  readAt: null,
  actionUrl,
});

const getRoleBellConfig = (role?: string): RoleBellConfig | null => {
  const normalizedRole = (role || "").toLowerCase();

  if (normalizedRole.includes("specialista")) {
    return {
      endpoint: "/specialista/richieste-consulto",
      params: { stato: "in_attesa" },
      actionUrl: "/specialista/richieste",
      title: "Richieste consulti specialista",
    };
  }

  if (normalizedRole.includes("professionista")) {
    return {
      endpoint: "/professionista/richieste-appuntamento",
      params: { stato: "in_attesa" },
      actionUrl: "/professionista/richieste",
      title: "Richieste appuntamento professionista",
    };
  }

  if (normalizedRole.includes("laboratorio")) {
    return {
      endpoint: "/laboratori/dashboard/richieste-analisi",
      params: { stato: "in_attesa" },
      actionUrl: "/laboratorio/richieste-analisi",
      title: "Richieste analisi laboratorio",
    };
  }

  if (normalizedRole.includes("medico")) {
    return {
      endpoint: "/medico/richieste",
      actionUrl: "/medico/richieste",
      title: "Richieste medico",
    };
  }

  if (normalizedRole.includes("farmacista")) {
    return {
      actionUrl: "/farmacia/batch/verifica",
      title: "Lavorazioni batch farmacia",
    };
  }

  if (normalizedRole.includes("rider")) {
    return {
      actionUrl: "/delivery/ritiri",
      title: "Ritiri e consegne rider",
    };
  }

  if (normalizedRole.includes("admin")) {
    return {
      actionUrl: "/admin/batch",
      title: "Batch delivery da gestire",
    };
  }

  return null;
};

const formatNotificationTime = (value?: string) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export function Header() {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const isPaziente = user?.ruolo === "paziente";
  const roleBellConfig = useMemo(() => getRoleBellConfig(user?.ruolo), [user?.ruolo]);
  const showBell = isPaziente || Boolean(roleBellConfig);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState<HeaderNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const menuRef = useRef<HTMLDivElement | null>(null);
  // Traccia il conteggio precedente per rilevare nuove notifiche durante il polling
  const prevUnreadCountRef = useRef<number>(0);
  // Salta il suono al primo caricamento (evita alert all'apertura dell'app)
  const hasInitializedRef = useRef<boolean>(false);

  const hasUnread = unreadCount > 0;
  const badgeText = useMemo(() => (unreadCount > 99 ? "99+" : String(unreadCount)), [unreadCount]);

  const fetchDoctorBellSummary = async (): Promise<RoleBellSummary> => {
    const [rinnoviResponse, prescrizioniResponse, analisiResponse, miniFormsResponse] =
      await Promise.all([
        api.get("/medico/richieste-rinnovo", { params: { stato: "in_attesa" } }),
        api.get("/medico/richieste-prescrizione"),
        api.get("/medico/richieste-analisi", { params: { stato: "in_attesa" } }),
        api.get("/mini-form/per-medico"),
      ]);

    const rinnovi = extractItems(rinnoviResponse.data);
    const prescrizioni = extractItems(prescrizioniResponse.data).filter(
      (richiesta: any) =>
        richiesta?.stato === "in_attesa" ||
        richiesta?.stato === "attesa_posologia",
    );
    const analisi = extractItems(analisiResponse.data);
    const miniForms = extractItems(miniFormsResponse.data);

    const notifications: HeaderNotification[] = [];
    const now = new Date().toISOString();

    if (miniForms.length > 0) {
      notifications.push({
        id: "medico-pending-posologie",
        title: "Posologie da completare",
        body: `Hai ${miniForms.length} posologia/e in attesa di compilazione.`,
        createdAt: now,
        readAt: null,
        actionUrl: "/medico/richieste?autostart=posologia",
      });
    }

    if (prescrizioni.length > 0) {
      notifications.push({
        id: "medico-pending-prescriptions",
        title: "Richieste prescrizione in attesa",
        body: `Hai ${prescrizioni.length} richiesta/e prescrittive da gestire.`,
        createdAt: now,
        readAt: null,
        actionUrl: "/medico/richieste",
      });
    }

    if (rinnovi.length > 0) {
      notifications.push({
        id: "medico-pending-renewals",
        title: "Rinnovi terapia in attesa",
        body: `Hai ${rinnovi.length} richiesta/e rinnovo da verificare.`,
        createdAt: now,
        readAt: null,
        actionUrl: "/medico/richieste",
      });
    }

    if (analisi.length > 0) {
      notifications.push({
        id: "medico-pending-analysis",
        title: "Richieste analisi in attesa",
        body: `Hai ${analisi.length} richiesta/e analisi da valutare.`,
        createdAt: now,
        readAt: null,
        actionUrl: "/medico/richieste",
      });
    }

    return {
      count: rinnovi.length + prescrizioni.length + analisi.length + miniForms.length,
      notifications,
    };
  };

  const fetchFarmaciaBellSummary = async (): Promise<RoleBellSummary> => {
    const [verificaResponse, preparazioneResponse] = await Promise.all([
      api.get("/farmacia/batch/ordini-in-verifica"),
      api.get("/farmacia/batch/ordini-da-preparare"),
    ]);

    const inVerifica = extractItems(verificaResponse.data);
    const batchDaPreparare = extractItems(preparazioneResponse.data);
    const ordiniDaPreparare = batchDaPreparare.reduce(
      (sum: number, batch: any) => sum + (Array.isArray(batch?.ordini) ? batch.ordini.length : 0),
      0,
    );

    const notifications: HeaderNotification[] = [];

    if (inVerifica.length > 0) {
      notifications.push(
        buildRoleNotification(
          "farmacia-verifica",
          "Ordini batch in verifica",
          `Hai ${inVerifica.length} ordine/i da verificare in farmacia.`,
          "/farmacia/batch/verifica",
        ),
      );
    }

    if (ordiniDaPreparare > 0) {
      notifications.push(
        buildRoleNotification(
          "farmacia-preparazione",
          "Ordini da preparare",
          `Hai ${ordiniDaPreparare} ordine/i batch pronti per la preparazione.`,
          "/farmacia/batch/preparazione",
        ),
      );
    }

    return {
      count: inVerifica.length + ordiniDaPreparare,
      notifications,
    };
  };

  const fetchRiderBellSummary = async (): Promise<RoleBellSummary> => {
    const [ritiriResponse, consegneResponse] = await Promise.all([
      api.get("/delivery/batch/ritiri/ordini-pronti"),
      api.get("/delivery/rider/ordini", { params: { stato: "assegnato_rider" } }),
    ]);

    const ritiriPayload = unwrapApiData(ritiriResponse.data) ?? {};
    const ritiriNotifiche = Array.isArray(ritiriPayload?.notifiche) ? ritiriPayload.notifiche : [];
    const ritiriCount = Number(ritiriPayload?.totaleNotifiche ?? ritiriNotifiche.length ?? 0);
    const consegne = extractItems(consegneResponse.data);

    const notifications: HeaderNotification[] = [];

    if (ritiriCount > 0) {
      notifications.push(
        buildRoleNotification(
          "rider-ritiri",
          "Ritiri batch pronti",
          `Hai ${ritiriCount} ritiro/i batch pronti o assegnati nella tua zona.`,
          "/delivery/ritiri",
        ),
      );
    }

    if (consegne.length > 0) {
      notifications.push(
        buildRoleNotification(
          "rider-consegne",
          "Consegne assegnate",
          `Hai ${consegne.length} consegna/e già assegnate da prendere in carico.`,
          "/delivery/consegne",
        ),
      );
    }

    return {
      count: ritiriCount + consegne.length,
      notifications,
    };
  };

  const fetchAdminBellSummary = async (): Promise<RoleBellSummary> => {
    const response = await api.get("/delivery/batch/windows/current");
    const batch = unwrapApiData(response.data);

    if (!batch) {
      return { count: 0, notifications: [] };
    }

    const assignments = Array.isArray(batch?.assignments) ? batch.assignments : [];
    const ordiniNelBatch = getBatchOrdersCount(batch);
    const zoneSenzaFarmacia = assignments.filter((assignment: any) => !assignment?.farmacia?.id).length;
    const zoneSenzaRider = assignments.filter(
      (assignment: any) => Boolean(assignment?.farmacia?.id) && getAssignmentRiderCount(assignment) === 0,
    ).length;

    const notifications: HeaderNotification[] = [];

    if (ordiniNelBatch > 0) {
      notifications.push(
        buildRoleNotification(
          "admin-active-batch-orders",
          "Ordini nel batch operativo",
          `Il batch corrente contiene ${ordiniNelBatch} ordine/i da monitorare o assegnare.`,
          "/admin/batch",
        ),
      );
    }

    if (zoneSenzaFarmacia > 0) {
      notifications.push(
        buildRoleNotification(
          "admin-batch-missing-pharmacy",
          "Zone senza farmacia",
          `Ci sono ${zoneSenzaFarmacia} zona/e batch senza farmacia assegnata.`,
          "/admin/batch",
        ),
      );
    }

    if (zoneSenzaRider > 0) {
      notifications.push(
        buildRoleNotification(
          "admin-batch-missing-rider",
          "Zone senza rider",
          `Ci sono ${zoneSenzaRider} zona/e batch senza rider assegnato.`,
          "/admin/batch",
        ),
      );
    }

    return {
      count: ordiniNelBatch + zoneSenzaFarmacia + zoneSenzaRider,
      notifications,
    };
  };

  const fetchRolePendingCount = async (): Promise<number> => {
    if (!roleBellConfig) return 0;
    if ((user?.ruolo || "").toLowerCase().includes("medico")) {
      const summary = await fetchDoctorBellSummary();
      return summary.count;
    }
    if ((user?.ruolo || "").toLowerCase().includes("farmacista")) {
      const summary = await fetchFarmaciaBellSummary();
      return summary.count;
    }
    if ((user?.ruolo || "").toLowerCase().includes("rider")) {
      const summary = await fetchRiderBellSummary();
      return summary.count;
    }
    if ((user?.ruolo || "").toLowerCase().includes("admin")) {
      const summary = await fetchAdminBellSummary();
      return summary.count;
    }
    if (!roleBellConfig.endpoint) return 0;
    const response = await api.get(roleBellConfig.endpoint, {
      params: roleBellConfig.params,
    });
    const payload = unwrapApiData(response.data);
    const items = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.data)
      ? payload.data
      : Array.isArray(payload?.items)
      ? payload.items
      : Array.isArray(payload?.richieste)
      ? payload.richieste
      : [];
    return items.length;
  };

  // Genera un doppio beep sintetico via Web Audio API (nessun file audio necessario)
  const playReminderSound = () => {
    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtxClass) return;
      const ctx = new AudioCtxClass() as AudioContext;
      const playBeep = (startTime: number, freq: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.22, startTime + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.45);
        osc.start(startTime);
        osc.stop(startTime + 0.5);
      };
      playBeep(ctx.currentTime, 880);        // La5  — primo beep
      playBeep(ctx.currentTime + 0.52, 1109); // Do#6 — secondo beep (tono salente)
      setTimeout(() => ctx.close(), 1500);
    } catch {
      // Web Audio API non disponibile — nessun suono, nessun crash
    }
  };

  // Mostra notifica nativa del sistema operativo (richiede permesso)
  const showBrowserNotification = (count: number) => {
    if (typeof window === 'undefined') return;
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    try {
      new window.Notification('💊 Reminder farmaco', {
        body: count === 1
          ? 'Hai 1 nuova notifica — apri l\'app per i dettagli'
          : `Hai ${count} nuove notifiche — apri l'app per i dettagli`,
        icon: '/favicon.ico',
        tag: 'medication-reminder',  // sostituisce la precedente invece di impilare
        renotify: true,
      });
    } catch {
      // Notification API non disponibile
    }
  };

  const fetchUnreadCount = async () => {
    if (isPaziente) {
      try {
        const response = await api.get("/paziente/notifications/unread-count");
        const payload = unwrapApiData(response.data);
        const count = Number(payload?.count ?? 0);
        const safeCount = Number.isFinite(count) ? count : 0;

        // Attiva suono + notifica browser solo se il contatore AUMENTA dopo il primo caricamento
        // (evita alert all'apertura dell'app)
        if (hasInitializedRef.current && safeCount > prevUnreadCountRef.current) {
          playReminderSound();
          showBrowserNotification(safeCount);
        }

        prevUnreadCountRef.current = safeCount;
        hasInitializedRef.current = true;
        setUnreadCount(safeCount);
      } catch {
        setUnreadCount(0);
      }
      return;
    }

    if (!roleBellConfig) {
      setUnreadCount(0);
      return;
    }

    try {
      const count = await fetchRolePendingCount();
      setUnreadCount(count);
    } catch {
      setUnreadCount(0);
    }
  };

  const fetchNotifications = async () => {
    if (!showBell) return;
    setLoading(true);
    try {
      if (isPaziente) {
        const response = await api.get("/paziente/notifications", {
          params: { limit: 8, offset: 0 },
        });
        const payload = unwrapApiData(response.data);
        const items = Array.isArray(payload?.notifications) ? payload.notifications : [];
        setNotifications(items);
        const count = Number(payload?.unreadCount ?? 0);
        setUnreadCount(Number.isFinite(count) ? count : 0);
      } else if (roleBellConfig) {
        if ((user?.ruolo || "").toLowerCase().includes("medico")) {
          const summary = await fetchDoctorBellSummary();
          setUnreadCount(summary.count);
          setNotifications(
            summary.notifications.length > 0
              ? summary.notifications
              : [
                  {
                    id: "pending-requests",
                    title: roleBellConfig.title,
                    body: "Nessuna richiesta in attesa.",
                    createdAt: new Date().toISOString(),
                    readAt: new Date().toISOString(),
                    actionUrl: roleBellConfig.actionUrl,
                  },
                ],
          );
          return;
        }

        if ((user?.ruolo || "").toLowerCase().includes("farmacista")) {
          const summary = await fetchFarmaciaBellSummary();
          setUnreadCount(summary.count);
          setNotifications(
            summary.notifications.length > 0
              ? summary.notifications
              : [
                  {
                    id: "farmacia-pending-requests",
                    title: roleBellConfig.title,
                    body: "Nessuna lavorazione batch in attesa.",
                    createdAt: new Date().toISOString(),
                    readAt: new Date().toISOString(),
                    actionUrl: roleBellConfig.actionUrl,
                  },
                ],
          );
          return;
        }

        if ((user?.ruolo || "").toLowerCase().includes("rider")) {
          const summary = await fetchRiderBellSummary();
          setUnreadCount(summary.count);
          setNotifications(
            summary.notifications.length > 0
              ? summary.notifications
              : [
                  {
                    id: "rider-pending-requests",
                    title: roleBellConfig.title,
                    body: "Nessun ritiro o consegna in attesa.",
                    createdAt: new Date().toISOString(),
                    readAt: new Date().toISOString(),
                    actionUrl: roleBellConfig.actionUrl,
                  },
                ],
          );
          return;
        }

        if ((user?.ruolo || "").toLowerCase().includes("admin")) {
          const summary = await fetchAdminBellSummary();
          setUnreadCount(summary.count);
          setNotifications(
            summary.notifications.length > 0
              ? summary.notifications
              : [
                  {
                    id: "admin-pending-requests",
                    title: roleBellConfig.title,
                    body: "Nessun batch delivery in attesa.",
                    createdAt: new Date().toISOString(),
                    readAt: new Date().toISOString(),
                    actionUrl: roleBellConfig.actionUrl,
                  },
                ],
          );
          return;
        }

        const count = await fetchRolePendingCount();
        setUnreadCount(count);
        setNotifications([
          {
            id: "pending-requests",
            title: roleBellConfig.title,
            body:
              count > 0
                ? `Hai ${count} richiesta/e in attesa di gestione.`
                : "Nessuna richiesta in attesa.",
            createdAt: new Date().toISOString(),
            readAt: count > 0 ? null : new Date().toISOString(),
            actionUrl: roleBellConfig.actionUrl,
          },
        ]);
      }
    } catch {
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationClick = async (notification: HeaderNotification) => {
    if (!isPaziente) {
      setOpen(false);
      if (notification.actionUrl) {
        router.push(notification.actionUrl);
      }
      return;
    }

    try {
      if (!notification.readAt) {
        await api.put(`/paziente/notifications/${notification.id}/read`);
      }
      if (notification.actionUrl) {
        await api.put(`/paziente/notifications/${notification.id}/click`).catch(() => undefined);
      }
      setNotifications((prev) =>
        prev.map((item) =>
          item.id === notification.id ? { ...item, readAt: item.readAt || new Date().toISOString() } : item
        )
      );
      setUnreadCount((prev) => Math.max(0, prev - (notification.readAt ? 0 : 1)));
      setOpen(false);

      if (notification.actionUrl) {
        if (notification.actionUrl.startsWith("/")) {
          router.push(notification.actionUrl);
        } else {
          window.location.href = notification.actionUrl;
        }
      }
    } catch {
      // no-op: non bloccare UX header
    }
  };

  // Richiede permesso per notifiche browser native (solo paziente, una volta, dopo 3 secondi)
  useEffect(() => {
    if (!isPaziente) return;
    if (typeof window === 'undefined') return;
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'default') return;
    const timer = setTimeout(() => {
      Notification.requestPermission();
    }, 3000);
    return () => clearTimeout(timer);
  }, [isPaziente]);

  useEffect(() => {
    if (!showBell) return;
    fetchUnreadCount();
    const intervalId = window.setInterval(fetchUnreadCount, 60000);
    return () => window.clearInterval(intervalId);
  }, [showBell, isPaziente, roleBellConfig]);

  useEffect(() => {
    if (open) {
      fetchNotifications();
    }
  }, [open]);

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (!menuRef.current) return;
      if (event.target instanceof Node && !menuRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener("mousedown", onClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
    };
  }, [open]);

  return (
    <header className="flex h-16 items-center justify-between border-b bg-white px-6 shadow-sm">
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h2 className="text-lg font-semibold">Benvenuto, {(user?.nome && user?.cognome) ? `${user.nome} ${user.cognome}` : user?.username || "Utente"}</h2>
      </motion.div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          {showBell && (
            <div className="relative" ref={menuRef}>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setOpen((prev) => !prev)}
                className="relative"
                aria-label="Notifiche"
              >
                <Bell className="h-4 w-4" />
                {hasUnread && (
                  <span className="absolute -right-1 -top-1 min-w-[18px] rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">
                    {badgeText}
                  </span>
                )}
              </Button>

              {open && (
                <div className="absolute right-0 z-50 mt-2 w-[360px] rounded-md border bg-white shadow-lg">
                  <div className="border-b px-3 py-2">
                    <p className="text-sm font-semibold">Notifiche</p>
                    <p className="text-xs text-gray-500">
                      {hasUnread
                        ? `${unreadCount} ${isPaziente ? "non lette" : "in attesa"}`
                        : isPaziente
                        ? "Nessuna notifica non letta"
                        : "Nessuna richiesta in attesa"}
                    </p>
                  </div>
                  <div className="max-h-[360px] overflow-y-auto">
                    {loading && <p className="px-3 py-4 text-sm text-gray-500">Caricamento...</p>}
                    {!loading && notifications.length === 0 && (
                      <p className="px-3 py-4 text-sm text-gray-500">Nessuna notifica disponibile</p>
                    )}
                    {!loading &&
                      notifications.map((notification) => {
                        const isRead = Boolean(notification.readAt);
                        return (
                          <button
                            key={notification.id}
                            type="button"
                            onClick={() => handleNotificationClick(notification)}
                            className={`w-full border-b px-3 py-3 text-left hover:bg-gray-50 ${
                              isRead ? "bg-white" : "bg-blue-50/50"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <p className={`text-sm ${isRead ? "font-medium" : "font-semibold"}`}>
                                {notification.title || "Notifica"}
                              </p>
                              {!isRead && <span className="mt-1 h-2 w-2 rounded-full bg-blue-600" />}
                            </div>
                            {notification.body && (
                              <p className="mt-1 line-clamp-2 text-xs text-gray-600">{notification.body}</p>
                            )}
                            <p className="mt-1 text-[11px] text-gray-400">
                              {formatNotificationTime(notification.createdAt)}
                            </p>
                          </button>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
          )}

          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-sm text-gray-600 capitalize hidden sm:inline"
          >
            {user?.ruolo}
          </motion.span>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: 0.3 }}
          >
            <Button
              variant="outline"
              size="default"
              onClick={logout}
              className="flex items-center gap-2 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 hover-lift"
            >
              <LogOut className="h-4 w-4" />
              <span>Esci</span>
            </Button>
          </motion.div>
        </div>
      </div>
    </header>
  );
}
