"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import Link from "next/link";

function RicettaZeroLogo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <svg width="26" height="26" viewBox="-14 -14 28 28" aria-hidden="true">
        {/* Arco blu 290° — ciclo terapeutico */}
        <path
          d="M 7.5 -10.7 A 13 13 0 1 1 -7.5 -10.7"
          fill="none"
          stroke="white"
          strokeWidth="5"
          strokeLinecap="butt"
        />
        {/* Arco verde 70° — corona anticipatoria */}
        <path
          d="M -7.5 -10.7 A 13 13 0 0 1 7.5 -10.7"
          fill="none"
          stroke="#5A8A6E"
          strokeWidth="5"
          strokeLinecap="round"
        />
      </svg>
      <span className="text-lg font-extrabold tracking-tight text-white">
        Ricetta<span className="text-brand-accent-light">Zero</span>
      </span>
    </div>
  );
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

interface AppHeaderProps {
  nTerapie?: number;
  nUrgenze?: number;
  hasConsegnaOggi?: boolean;
}

export function AppHeader({
  nTerapie = 0,
  nUrgenze = 0,
  hasConsegnaOggi = false,
}: AppHeaderProps) {
  const { user } = useAuthStore();
  const isPaziente = user?.ruolo === "paziente";
  const [unreadCount, setUnreadCount] = useState(0);
  const nome = user?.nome ?? user?.username ?? "Utente";
  const today = formatDate(new Date());

  // Poll unread notifications count (same pattern as Header.tsx)
  useEffect(() => {
    if (!isPaziente) {
      setUnreadCount(0);
      return;
    }

    let cancelled = false;
    const fetchCount = async () => {
      try {
        const res = await api.get("/paziente/notifications/unread-count");
        const payload = res.data?.data ?? res.data;
        const count = Number(payload?.count ?? 0);
        if (!cancelled) setUnreadCount(Number.isFinite(count) ? count : 0);
      } catch {
        // silent — bell just shows no badge
      }
    };
    fetchCount();
    const id = window.setInterval(fetchCount, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [isPaziente]);

  return (
    <div className="bg-brand-primary">
      {/* Blocco 1: logo + bell */}
      <div className="flex items-center justify-between px-4 py-3">
        <RicettaZeroLogo />
        <Link
          href="/paziente/comunicazioni"
          className="relative flex h-9 w-9 items-center justify-center rounded-full bg-white/10"
          aria-label="Notifiche"
        >
          <Bell className="h-4 w-4 text-white/80" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-brand-danger px-1 text-[9px] font-bold text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Link>
      </div>

      {/* Blocco 2: greeting + chips */}
      <div className="px-4 pb-4">
        <p className="text-[10px] uppercase tracking-[0.05em] text-white/40">
          {today}
        </p>
        <h1 className="mt-0.5 text-lg font-extrabold tracking-tight text-white">
          Ciao, {nome} 👋
        </h1>
        <p className="text-xs text-white/50">La tua salute, zero pensieri.</p>

        {/* Chips — scroll orizzontale se overflow */}
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {nTerapie > 0 && (
            <span className="flex-shrink-0 rounded-full border border-brand-accent/30 bg-brand-accent/20 px-3 py-1 text-[10px] font-semibold text-green-200">
              {nTerapie} {nTerapie === 1 ? "terapia attiva" : "terapie attive"}
            </span>
          )}
          {nUrgenze > 0 && (
            <span className="flex-shrink-0 rounded-full border border-brand-danger/30 bg-brand-danger/20 px-3 py-1 text-[10px] font-semibold text-red-200">
              {nUrgenze} {nUrgenze === 1 ? "scadenza" : "scadenze"}
            </span>
          )}
          {hasConsegnaOggi && (
            <span className="flex-shrink-0 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] font-semibold text-white/70">
              Consegna oggi
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
