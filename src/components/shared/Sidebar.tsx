"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FileText,
  ShoppingCart,
  User,
  LogOut,
  MapPin,
  Package,
  Pill,
  ClipboardList,
  RefreshCw,
  ClipboardCheck,
  BarChart3,
  MessageSquare,
  AlertCircle,
  Users,
  Shield,
  Mail,
  HelpCircle,
  BookOpen,
  CreditCard,
  PawPrint,
  Calendar,
  ArrowRightLeft,
  Inbox,
  Truck,
  BellRing,
  Syringe,
  HeartPulse,
  Store,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth-store";
import { motion } from "framer-motion";

interface SidebarProps {
  role: "paziente" | "medico" | "specialista" | "professionista" | "farmacista" | "laboratorio" | "rider" | "admin" | "fornitore_sanitario" | "professionista_sanitario";
}

const menuItems = {
  paziente: [
    { href: "/paziente/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/paziente/ricerca-servizi", label: "Cerca Professionisti", icon: ClipboardCheck },
    { href: "/paziente/consulti", label: "Consulti", icon: MessageSquare },
    { href: "/paziente/referti", label: "Referti", icon: FileText },
    { href: "/paziente/il-mio-medico", label: "Il Mio Medico", icon: User },
    { href: "/paziente/la-mia-cura", label: "La Mia Cura", icon: Pill },
    { href: "/paziente/aderenza", label: "Reminder Farmaci", icon: BellRing },
    { href: "/paziente/farmacie", label: "Farmacie vicine", icon: Store },
    { href: "/paziente/vaccinazioni", label: "Vaccinazioni", icon: Syringe },
    { href: "/paziente/cure-preventive", label: "Cure Preventive", icon: HeartPulse },
    { href: "/paziente/shop-ordini", label: "Farmaci da banco", icon: ShoppingCart },
    { href: "/paziente/dispensa", label: "Dispensa Farmaci", icon: Package },
    { href: "/paziente/profilo/animali", label: "I Miei Animali", icon: PawPrint },
    { href: "/paziente/salute-benessere", label: "Salute & Benessere", icon: ClipboardList },
    { href: "/paziente/profilo", label: "Profilo", icon: User },
    { href: "/paziente/analytics", label: "Analytics", icon: BarChart3 },
    { href: "/paziente/guida", label: "Guida", icon: BookOpen },
  ],
  medico: [
    { href: "/medico/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/medico/analytics", label: "Analytics", icon: BarChart3 },
    { href: "/medico/calendario", label: "Calendario", icon: Calendar },
    { href: "/medico/richieste-visita", label: "Richieste Visita", icon: ClipboardCheck },
    { href: "/medico/richieste", label: "Richieste", icon: Inbox },
    { href: "/medico/richieste-prescrizione", label: "Richieste Prescrizione", icon: FileText },
    { href: "/medico/messaggi", label: "Messaggi", icon: Mail },
    { href: "/medico/pazienti", label: "Pazienti", icon: User },
    { href: "/medico/profilo", label: "Profilo", icon: User },
  ],
  specialista: [
    { href: "/specialista/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/specialista/pazienti", label: "Pazienti", icon: Users },
    { href: "/specialista/calendario", label: "Calendario", icon: Calendar },
    { href: "/specialista/richieste", label: "Richieste", icon: ClipboardList },
    { href: "/specialista/consulti", label: "Consulti", icon: MessageSquare },
    { href: "/specialista/profilo", label: "Profilo", icon: User },
  ],
  professionista: [
    { href: "/professionista/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/professionista/appuntamenti", label: "Appuntamenti", icon: Calendar },
    { href: "/professionista/assistiti", label: "Assistiti", icon: Users },
    { href: "/professionista/calendario", label: "Calendario", icon: Calendar },
    { href: "/professionista/richieste", label: "Richieste", icon: ClipboardList },
    { href: "/professionista/profilo", label: "Profilo", icon: User },
  ],
  professionista_sanitario: [
    { href: "/professionista/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/professionista/appuntamenti", label: "Appuntamenti", icon: Calendar },
    { href: "/professionista/assistiti", label: "Assistiti", icon: Users },
    { href: "/professionista/calendario", label: "Calendario", icon: Calendar },
    { href: "/professionista/richieste", label: "Richieste", icon: ClipboardList },
    { href: "/professionista/profilo", label: "Profilo", icon: User },
  ],
  fornitore_sanitario: [
    { href: "/fornitore/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/fornitore/clienti", label: "Clienti", icon: Users },
    { href: "/fornitore/assistiti", label: "Assistiti", icon: ClipboardCheck },
    { href: "/fornitore/calendario", label: "Calendario", icon: Calendar },
    { href: "/fornitore/ordini", label: "Ordini", icon: ShoppingCart },
    { href: "/fornitore/contratti", label: "Contratti", icon: FileText },
    { href: "/fornitore/monitoraggio", label: "Monitoraggio", icon: BarChart3 },
    { href: "/fornitore/profilo", label: "Profilo", icon: User },
  ],
  farmacista: [
    { href: "/farmacia/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/farmacia/calendario", label: "Calendario", icon: Calendar },
    { href: "/farmacia/ordini", label: "Ordini", icon: ShoppingCart },
    { href: "/farmacia/batch/preparazione", label: "Preparazione Batch", icon: Package },
    { href: "/farmacia/batch/fallback", label: "Fallback Batch", icon: AlertCircle },
    { href: "/farmacia/catalogo", label: "Catalogo", icon: FileText },
    { href: "/farmacia/shop", label: "Shop", icon: MapPin },
    { href: "/farmacia/sicurezza", label: "Sicurezza / Chiavi", icon: Shield },
    { href: "/farmacia/profilo", label: "Profilo", icon: User },
  ],
  laboratorio: [
    { href: "/laboratorio/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/laboratorio/calendario", label: "Calendario", icon: Calendar },
    { href: "/laboratorio/prenotazioni", label: "Prenotazioni", icon: ClipboardList },
    { href: "/laboratorio/referti", label: "Referti", icon: FileText },
    { href: "/laboratorio/profilo", label: "Profilo", icon: User },
  ],
  rider: [
    { href: "/delivery/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/delivery/ordini", label: "Ordini", icon: ShoppingCart },
    { href: "/delivery/ritiri", label: "Ritiri Batch", icon: Package },
    { href: "/delivery/pos", label: "POS", icon: CreditCard },
    { href: "/delivery/richieste-dirette", label: "Richieste Dirette", icon: MessageSquare },
    { href: "/delivery/rotte", label: "Rotte", icon: MapPin },
    { href: "/delivery/storico", label: "Storico Consegne", icon: ClipboardCheck },
    { href: "/delivery/profilo", label: "Profilo", icon: User },
  ],
  admin: [
    { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/admin/batch", label: "Batch Delivery", icon: Truck },
    { href: "/admin/riders", label: "Riders", icon: Package },
    { href: "/admin/ordini", label: "Ordini Disponibili", icon: Package },
    { href: "/admin/users", label: "Utenti", icon: User },
    { href: "/admin/statistics", label: "Statistiche", icon: FileText },
    { href: "/admin/medici/richieste-cambio", label: "Cambio Medico", icon: ArrowRightLeft },
  ],
};

export function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname();
  const { logout } = useAuthStore();
  const items = menuItems[role] || [];
  const normalizedPath = pathname !== "/" && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  const activeHref =
    items
      .filter((item) => normalizedPath === item.href || normalizedPath.startsWith(item.href + "/"))
      .sort((a, b) => b.href.length - a.href.length)[0]?.href ?? null;

  return (
    <div className="flex h-screen w-64 flex-col border-r bg-gray-50 z-10">
      <div className="flex h-16 items-center border-b px-6 bg-white">
        <h1 className="text-xl font-bold text-primary">RicettaZero</h1>
      </div>
      <nav className="flex-1 space-y-1 p-4 overflow-y-auto">
        {items.map((item, index) => {
          const Icon = item.icon ?? null;
          const isActive = activeHref === item.href;
          return (
            <motion.div
              key={item.href}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
            >
              <Link
                href={item.href}
                className={cn(
                  "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all hover-lift",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "text-gray-700 hover:bg-gray-100"
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeIndicator"
                    className="absolute left-0 top-0 bottom-0 w-1 bg-primary-foreground rounded-r"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
                {Icon && <Icon className="h-5 w-5" />}
                {item.label}
              </Link>
            </motion.div>
          );
        })}
      </nav>
      <div className="border-t p-4">
        <Button
          variant="ghost"
          className="w-full justify-start"
          onClick={logout}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </Button>
      </div>
    </div>
  );
}
