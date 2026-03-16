import Link from "next/link";
import { getTranslations } from 'next-intl/server';

export default async function Home() {
  const t = await getTranslations('home');
  const tNav = await getTranslations('nav');

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 sm:gap-12 bg-[#000000] p-4 sm:p-8 text-[#fff1e8] pb-mobile-nav">
      <div className="text-center space-y-3 sm:space-y-4">
        <h1 className="font-pixel text-2xl sm:text-3xl md:text-4xl text-[#ffa300] animate-pulse">
          {t('title')}
        </h1>
        <p className="font-pixel text-[10px] sm:text-xs text-[#c2c3c7] max-w-md mx-auto leading-relaxed px-4">
          {t('subtitle')} <br className="hidden sm:block" />
          {t('description')}
        </p>
      </div>

      <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-3 w-full max-w-4xl px-2">
        <Link
          href="/town"
          className="group relative flex flex-col items-center gap-3 sm:gap-4 rounded-xl border-4 border-[#5f574f] bg-[#1d2b53] p-6 sm:p-8 transition-all hover:-translate-y-1 hover:border-[#00e436] hover:shadow-[0_4px_0_0_#00e436] active:translate-y-0 active:shadow-none touch-manipulation"
        >
          <span className="text-3xl sm:text-4xl" role="img" aria-label="Town">
            🏘️
          </span>
          <div className="text-center space-y-1 sm:space-y-2">
            <h2 className="font-pixel text-base sm:text-lg text-[#fff1e8] group-hover:text-[#00e436]">
              {t('townView.title')}
            </h2>
            <p className="font-pixel text-[9px] sm:text-[10px] text-[#83769c] leading-relaxed">
              {t('townView.description')}
            </p>
          </div>
        </Link>

        <Link
          href="/feed"
          className="group relative flex flex-col items-center gap-3 sm:gap-4 rounded-xl border-4 border-[#5f574f] bg-[#1d2b53] p-6 sm:p-8 transition-all hover:-translate-y-1 hover:border-[#ff004d] hover:shadow-[0_4px_0_0_#ff004d] active:translate-y-0 active:shadow-none touch-manipulation"
        >
          <span className="text-3xl sm:text-4xl" role="img" aria-label="Feed">
            📱
          </span>
          <div className="text-center space-y-1 sm:space-y-2">
            <h2 className="font-pixel text-base sm:text-lg text-[#fff1e8] group-hover:text-[#ff004d]">
              {t('socialFeed.title')}
            </h2>
            <p className="font-pixel text-[9px] sm:text-[10px] text-[#83769c] leading-relaxed">
              {t('socialFeed.description')}
            </p>
          </div>
        </Link>

        <Link
          href="/timeline"
          className="group relative flex flex-col items-center gap-3 sm:gap-4 rounded-xl border-4 border-[#5f574f] bg-[#1d2b53] p-6 sm:p-8 transition-all hover:-translate-y-1 hover:border-[#29adff] hover:shadow-[0_4px_0_0_#29adff] active:translate-y-0 active:shadow-none touch-manipulation"
        >
          <span className="text-3xl sm:text-4xl" role="img" aria-label="Timeline">
            📊
          </span>
          <div className="text-center space-y-1 sm:space-y-2">
            <h2 className="font-pixel text-base sm:text-lg text-[#fff1e8] group-hover:text-[#29adff]">
              {t('timeline.title')}
            </h2>
            <p className="font-pixel text-[9px] sm:text-[10px] text-[#83769c] leading-relaxed">
              {t('timeline.description')}
            </p>
          </div>
        </Link>
      </div>

      <footer className="mt-4 sm:mt-8 text-center space-y-1">
        <span className="font-pixel text-[9px] sm:text-[10px] text-[#5f574f]">
          {t('footer')}{" "}
          <a
            href="https://github.com/nicepkg/openclaw"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#83769c] hover:text-[#c2c3c7] underline decoration-dotted"
          >
            OpenClaw
          </a>{" "}
          AI agents
        </span>
      </footer>
    </main>
  );
}
