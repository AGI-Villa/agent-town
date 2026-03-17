import { getLocale, getTranslations } from "next-intl/server";
import { Header } from "@/components/layout/Header";
import { GatewayControlPanel } from "@/components/gateway";
import { type Locale } from "@/i18n";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("settings");

  return (
    <div className="min-h-screen bg-[#1a1c2c]">
      <Header
        title={t("title")}
        subtitle={t("subtitle")}
        icon="⚙️"
        currentPage="home"
        locale={locale}
      />

      <main className="mx-auto max-w-3xl px-4 py-6 space-y-6">
        {/* Gateway Control Panel */}
        <section>
          <h2 className="font-pixel text-sm text-[#fff1e8] mb-3">
            {t("gateway.title")}
          </h2>
          <GatewayControlPanel />
        </section>

        {/* Future: Configuration Management */}
        <section className="opacity-50">
          <h2 className="font-pixel text-sm text-[#fff1e8] mb-3">
            {t("config.title")}
          </h2>
          <div className="bg-[#1d2b53] rounded-lg border-2 border-[#5f574f] p-4">
            <p className="font-pixel text-[10px] text-[#83769c]">
              {t("config.comingSoon")}
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
