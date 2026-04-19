"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";
import { Sidebar } from "@/components/shared/Sidebar";
import { Header } from "@/components/shared/Header";
import { Loader2 } from "lucide-react";

export default function DeliveryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuthStore();

  useEffect(() => {
    if (isLoading) return; // Attendi il termine del caricamento auth
    if (!isAuthenticated) {
      router.push("/login?role=rider");
    } else if (user?.ruolo !== "rider") {
      if (user?.ruolo === "paziente") {
        router.push("/paziente/dashboard");
      } else if (user?.ruolo === "medico") {
        router.push("/medico/dashboard");
      } else if (user?.ruolo === "specialista") {
        router.push("/specialista/dashboard");
      } else if (user?.ruolo === "professionista_sanitario" || user?.ruolo === "professionista") {
        router.push("/professionista/dashboard");
      } else if (user?.ruolo === "farmacista") {
        router.push("/farmacia/dashboard");
      } else if (user?.ruolo === "admin") {
        router.push("/admin/dashboard");
      } else {
        router.push("/login?role=rider");
      }
    }
  }, [isAuthenticated, isLoading, user, router]);

  // Durante il caricamento auth mostra uno spinner invece di smontare i children
  // (evita che la pagina rimmonti azzerando lo stato dei form)
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAuthenticated || user?.ruolo !== "rider") {
    return null;
  }

  return (
    <div className="flex h-screen">
      <Sidebar role="rider" />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto bg-gray-50 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
