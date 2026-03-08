import { StatusGrid } from "@/components/status/StatusGrid";
import { WatcherControl } from "@/components/status/WatcherControl";

export const metadata = {
  title: "Status Panel | Agent Town",
  description: "Monitor your AI agents in real-time",
};

export default function StatusPage() {
  return (
    <main className="min-h-screen bg-[#000000]">
      {/* Header */}
      <header className="border-b-4 border-[#5f574f] bg-[#1d2b53] px-4 py-6 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex items-center gap-3">
            <span className="text-2xl" role="img" aria-label="Town">
              🏘️
            </span>
            <div>
              <h1 className="font-pixel text-lg text-[#fff1e8] sm:text-xl">
                AGENT TOWN
              </h1>
              <p className="font-pixel text-[10px] text-[#c2c3c7]">
                STATUS PANEL
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
              className="font-pixel text-[10px] text-[#ffa300] underline underline-offset-4"
              aria-current="page"
            >
              STATUS
            </a>
            <a
              href="/feed"
              className="font-pixel text-[10px] text-[#83769c] hover:text-[#fff1e8] transition-colors"
            >
              FEED
            </a>
          </nav>
        </div>
      </header>

      {/* Content */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-8">
        <WatcherControl />
        <StatusGrid />
      </div>
    </main>
  );
}
