"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Pill, FileText, ShoppingCart, User } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/paziente/dashboard",   label: "Home",    Icon: Home },
  { href: "/paziente/la-mia-cura", label: "Cure",    Icon: Pill },
  { href: "/paziente/referti",     label: "Referti", Icon: FileText },
  { href: "/paziente/shop-ordini", label: "Farmaci", Icon: ShoppingCart },
  { href: "/paziente/profilo",     label: "Profilo", Icon: User },
] as const;

interface BottomNavProps {
  className?: string;
}

export function BottomNav({ className }: BottomNavProps) {
  const pathname = usePathname();

  return (
    <nav
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-brand-bg-blue",
        className,
      )}
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex h-16 items-center">
        {tabs.map(({ href, label, Icon }) => {
          const isActive =
            pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-1 flex-col items-center justify-center gap-1 py-2"
            >
              <div
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-lg transition-colors",
                  isActive
                    ? "bg-brand-primary"
                    : "bg-transparent",
                )}
              >
                <Icon
                  className={cn(
                    "h-4 w-4",
                    isActive ? "text-white" : "text-brand-muted",
                  )}
                />
              </div>
              <span
                className={cn(
                  "text-[9px] font-semibold",
                  isActive ? "text-brand-primary" : "text-brand-muted",
                )}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
