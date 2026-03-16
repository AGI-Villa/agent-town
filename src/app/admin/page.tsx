import { Header } from "@/components/layout";
import { GatewayControlPanel } from "@/components/gateway";
import { getTranslations } from "next-intl/server";
import { getLocale } from "@/i18n/actions";

export default async function AdminPage() {
  const t = await getTranslations("admin");
  const locale = await getLocale();

  return (
    <div className="min-h-screen bg-[#000000] pb-mobile-nav">
      <Header
        title={t("title")}
        subtitle={t("subtitle")}
        icon="⚙️"
        currentPage="home"
        locale={locale}
      />
      <main className="mx-auto max-w-3xl px-3 py-4 sm:px-8 sm:py-6">
        <GatewayControlPanel />
      </main>
    </div>
  );
}
