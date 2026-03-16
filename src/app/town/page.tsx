import { getLocale } from 'next-intl/server';
import { type Locale } from '@/i18n';
import { TownPageClient } from './TownPageClient';

export default async function TownPage() {
  const locale = await getLocale() as Locale;
  return <TownPageClient locale={locale} />;
}
