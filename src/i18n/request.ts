import { getRequestConfig } from 'next-intl/server';
import { cookies, headers } from 'next/headers';

export const locales = ['en', 'zh'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';

export default getRequestConfig(async () => {
  // Try to get locale from cookie first
  const cookieStore = await cookies();
  const localeCookie = cookieStore.get('locale')?.value;
  
  // Then try Accept-Language header
  let locale: Locale = defaultLocale;
  
  if (localeCookie && locales.includes(localeCookie as Locale)) {
    locale = localeCookie as Locale;
  } else {
    const headersList = await headers();
    const acceptLanguage = headersList.get('accept-language') || '';
    
    // Parse Accept-Language header
    const preferredLocales = acceptLanguage
      .split(',')
      .map(lang => lang.split(';')[0].trim().toLowerCase())
      .map(lang => lang.split('-')[0]); // Get primary language tag
    
    // Find first matching locale
    for (const preferred of preferredLocales) {
      if (locales.includes(preferred as Locale)) {
        locale = preferred as Locale;
        break;
      }
    }
  }

  return {
    locale,
    messages: (await import(`./locales/${locale}.json`)).default
  };
});
