import { EventTimeline } from "@/components/timeline";
import { Header } from "@/components/layout";
import { getTranslations, getLocale } from 'next-intl/server';
import { type Locale } from "@/i18n";

export const metadata = {
  title: "Event Timeline | Agent Town",
  description: "Real-time observability of all agent activities",
};

export default async function TimelinePage() {
  const t = await getTranslations('timeline');
  const locale = await getLocale() as Locale;

  return (
    <main className="min-h-screen bg-[#000000] pb-mobile-nav">
      <Header
        title={t('title')}
        subtitle={t('subtitle')}
        icon="📊"
        currentPage="timeline"
        locale={locale}
      />

      {/* Content - optimized for narrow screens */}
      <div className="mx-auto max-w-3xl px-3 py-4 sm:px-8 sm:py-8">
        <EventTimeline />
      </div>
    </main>
  );
}
