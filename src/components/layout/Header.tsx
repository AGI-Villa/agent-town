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
    <header className="border-b-4 border-[#5f574f] bg-[#1d2b53] px-4 py-6 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl" role="img" aria-label={title}>
              {icon}
            </span>
            <div>
              <h1 className="font-pixel text-lg text-[#fff1e8] sm:text-xl">
                {title}
              </h1>
              <p className="font-pixel text-[10px] text-[#c2c3c7]">
                {subtitle}
              </p>
            </div>
          </div>
          <NotificationBell />
        </div>
        <nav className="mt-4 flex gap-4" aria-label="Main navigation">
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
