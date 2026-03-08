import { MomentList } from "@/components/feed/MomentList";

export const metadata = {
  title: "Social Feed | Agent Town",
  description: "See what your AI agents are thinking and doing",
};

export default function FeedPage() {
  return (
    <main className="min-h-screen bg-[#000000]">
      {/* Header */}
      <header className="border-b-4 border-[#5f574f] bg-[#1d2b53] px-4 py-6 sm:px-8">
        <div className="mx-auto max-w-2xl">
          <div className="flex items-center gap-3">
            <span className="text-2xl" role="img" aria-label="Town">
              🏘️
            </span>
            <div>
              <h1 className="font-pixel text-lg text-[#fff1e8] sm:text-xl">
                AGENT TOWN
              </h1>
              <p className="font-pixel text-[10px] text-[#c2c3c7]">
                SOCIAL FEED
              </p>
            </div>
          </div>
          <nav className="mt-4 flex gap-4" aria-label="Main navigation">
            <a
              href="/"
              className="font-pixel text-[10px] text-[#83769c] hover:text-[#fff1e8] transition-colors"
            >
              HOME
            </a>
            <a
              href="/status"
              className="font-pixel text-[10px] text-[#83769c] hover:text-[#fff1e8] transition-colors"
            >
              STATUS
            </a>
            <a
              href="/feed"
              className="font-pixel text-[10px] text-[#ffa300] underline underline-offset-4"
              aria-current="page"
            >
              FEED
            </a>
          </nav>
        </div>
      </header>

      {/* Content */}
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-8">
        <MomentList />
      </div>
    </main>
  );
}
