"use client";

import { useTranslations } from 'next-intl';
import { NotificationBell } from "@/components/notifications";
import { LanguageSwitcher } from "@/components/i18n";
import { WorkspaceSelector } from "@/components/workspace";
import { type Locale } from "@/i18n";

interface HeaderProps {
  title: string;
  subtitle: string;
  icon: string;
  currentPage: "home" | "town" | "feed" | "timeline" | "replay";
  locale: Locale;
}

const navItems = [
  { href: "/", labelKey: "home", key: "home" },
  { href: "/town", labelKey: "town", key: "town" },
  { href: "/feed", labelKey: "feed", key: "feed" },
  { href: "/timeline", labelKey: "timeline", key: "timeline" },
  { href: "/replay", labelKey: "replay", key: "replay" },
] as const;

export function Header({ title, subtitle, icon, currentPage, locale }: HeaderProps) {
  const t = useTranslations('nav');

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
          <div className="flex items-center gap-2 sm:gap-4">
            <WorkspaceSelector />
            <LanguageSwitcher currentLocale={locale} variant="buttons" />
            <NotificationBell />
          </div>
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
              {t(item.labelKey)}
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}
