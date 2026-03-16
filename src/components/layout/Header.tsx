"use client";

import { NotificationBell } from "@/components/notifications";

interface HeaderProps {
  title: string;
  subtitle: string;
  icon: string;
  currentPage: "home" | "town" | "feed" | "timeline";
}

const navItems = [
  { href: "/", label: "HOME", key: "home" },
  { href: "/town", label: "TOWN", key: "town" },
  { href: "/feed", label: "FEED", key: "feed" },
  { href: "/timeline", label: "TIMELINE", key: "timeline" },
] as const;

export function Header({ title, subtitle, icon, currentPage }: HeaderProps) {
  return (
    <header className="border-b-4 border-[#5f574f] bg-[#1d2b53] px-3 py-4 sm:px-8 sm:py-6 safe-area-top">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="text-xl sm:text-2xl" role="img" aria-label={title}>
              {icon}
            </span>
            <div>
              <h1 className="font-pixel text-base text-[#fff1e8] sm:text-xl">
                {title}
              </h1>
              <p className="font-pixel text-[9px] sm:text-[10px] text-[#c2c3c7]">
                {subtitle}
              </p>
            </div>
          </div>
          <NotificationBell />
        </div>
        {/* Desktop navigation - hidden on mobile (using bottom nav instead) */}
        <nav className="mt-4 hidden gap-4 md:flex" aria-label="Main navigation">
          {navItems.map((item) => (
            <a
              key={item.key}
              href={item.href}
              className={
                currentPage === item.key
                  ? "font-pixel text-[10px] text-[#ffa300] underline underline-offset-4"
                  : "font-pixel text-[10px] text-[#83769c] hover:text-[#fff1e8] transition-colors"
              }
              aria-current={currentPage === item.key ? "page" : undefined}
            >
              {item.label}
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}
