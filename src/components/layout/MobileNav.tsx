"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from 'next-intl';
import { Home, MapPin, MessageSquare, Activity } from "lucide-react";

const navItems = [
  { href: "/", labelKey: "home", icon: Home, key: "home" },
  { href: "/town", labelKey: "town", icon: MapPin, key: "town" },
  { href: "/feed", labelKey: "feed", icon: MessageSquare, key: "feed" },
  { href: "/timeline", labelKey: "timeline", icon: Activity, key: "timeline" },
] as const;

export function MobileNav() {
  const pathname = usePathname();
  const t = useTranslations('nav');

  const getCurrentPage = () => {
    if (pathname === "/") return "home";
    if (pathname.startsWith("/town")) return "town";
    if (pathname.startsWith("/feed")) return "feed";
    if (pathname.startsWith("/timeline")) return "timeline";
    return "home";
  };

  const currentPage = getCurrentPage();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t-2 border-[#5f574f] bg-[#1d2b53]/95 backdrop-blur-sm md:hidden safe-area-bottom"
      aria-label="Mobile navigation"
    >
      <div className="flex items-center justify-around px-2 py-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.key;
          return (
            <Link
              key={item.key}
              href={item.href}
              className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors touch-manipulation ${
                isActive
                  ? "text-[#ffa300] bg-[#ffa300]/10"
                  : "text-[#83769c] hover:text-[#fff1e8] active:bg-white/5"
              }`}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon className="h-5 w-5" strokeWidth={isActive ? 2.5 : 2} />
              <span className="font-pixel text-[8px]">{t(item.labelKey)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
