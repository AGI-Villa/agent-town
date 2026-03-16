'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Globe } from 'lucide-react';
import { type Locale, locales } from '@/i18n';
import { setLocale } from '@/i18n/actions';

const LOCALE_NAMES: Record<Locale, string> = {
  en: 'English',
  zh: '中文',
};

interface LanguageSwitcherProps {
  currentLocale: Locale;
  variant?: 'dropdown' | 'buttons';
}

export function LanguageSwitcher({ currentLocale, variant = 'dropdown' }: LanguageSwitcherProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleLocaleChange = (locale: Locale) => {
    startTransition(async () => {
      await setLocale(locale);
      router.refresh();
    });
  };

  if (variant === 'buttons') {
    return (
      <div className="flex items-center gap-1">
        <Globe className="h-4 w-4 text-[#83769c]" />
        {locales.map((locale) => (
          <button
            key={locale}
            onClick={() => handleLocaleChange(locale)}
            disabled={isPending || locale === currentLocale}
            className={`font-pixel text-[10px] px-2 py-1 rounded transition-colors ${
              locale === currentLocale
                ? 'bg-[#ffa300] text-[#1d2b53]'
                : 'text-[#83769c] hover:text-[#fff1e8] hover:bg-[#5f574f]/30'
            } ${isPending ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {LOCALE_NAMES[locale]}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="relative">
      <select
        value={currentLocale}
        onChange={(e) => handleLocaleChange(e.target.value as Locale)}
        disabled={isPending}
        className={`appearance-none bg-[#1d2b53] border border-[#5f574f] rounded px-3 py-1.5 pr-8 font-pixel text-[10px] text-[#fff1e8] cursor-pointer hover:border-[#ffa300] focus:outline-none focus:border-[#ffa300] ${
          isPending ? 'opacity-50 cursor-not-allowed' : ''
        }`}
        aria-label="Select language"
      >
        {locales.map((locale) => (
          <option key={locale} value={locale}>
            {LOCALE_NAMES[locale]}
          </option>
        ))}
      </select>
      <Globe className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-[#83769c] pointer-events-none" />
    </div>
  );
}
