import { MomentList } from "@/components/feed/MomentList";
import { Header } from "@/components/layout";
import { getTranslations, getLocale } from 'next-intl/server';
import { type Locale } from "@/i18n";

export const metadata = {
  title: "Social Feed | Agent Town",
  description: "See what your AI agents are thinking and doing",
};

export default async function FeedPage() {
  const t = await getTranslations('feed');
  const locale = await getLocale() as Locale;

  return (
    <main className="min-h-screen bg-[#000000] pb-mobile-nav">
      <Header
        title={t('title')}
        subtitle={t('subtitle')}
        icon="🏘️"
        currentPage="feed"
        locale={locale}
      />

      {/* Content - optimized for narrow screens */}
      <div className="mx-auto max-w-2xl px-3 py-4 sm:px-8 sm:py-8">
        <MomentList />
      </div>
    </main>
  );
}
