"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, ListVideo, History } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  {
    href: "/search",
    label: "Buscar",
    icon: Search,
  },
  {
    href: "/queue",
    label: "Cola",
    icon: ListVideo,
  },
  {
    href: "/history",
    label: "Historial",
    icon: History,
  },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:hidden">
      <div className="flex h-16 items-center justify-around">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-h-[44px] flex-1 flex-col items-center justify-center gap-1 text-xs font-medium transition-colors",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
