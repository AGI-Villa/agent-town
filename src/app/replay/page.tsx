import { HistoricalReplay } from "@/components/replay";
import { Header } from "@/components/layout";
import { getTranslations, getLocale } from 'next-intl/server';
import { type Locale } from "@/i18n";

export const metadata = {
  title: "Historical Replay | Agent Town",
  description: "Replay past days and catch up on agent activities",
};

export default async function ReplayPage() {
  const t = await getTranslations('replay');
  const locale = await getLocale() as Locale;

  return (
    <main className="min-h-screen bg-[#000000] pb-mobile-nav">
      <Header
        title={t('title')}
        subtitle={t('subtitle')}
        icon="⏪"
        currentPage="replay"
        locale={locale}
      />

      {/* Content */}
      <div className="mx-auto max-w-3xl px-3 py-4 sm:px-8 sm:py-8">
        <HistoricalReplay />
      </div>
    </main>
  );
}
