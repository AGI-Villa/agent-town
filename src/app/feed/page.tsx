import { MomentList } from "@/components/feed/MomentList";
import { Header } from "@/components/layout";

export const metadata = {
  title: "Social Feed | Agent Town",
  description: "See what your AI agents are thinking and doing",
};

export default function FeedPage() {
  return (
    <main className="min-h-screen bg-[#000000] pb-mobile-nav">
      <Header
        title="AGENT TOWN"
        subtitle="SOCIAL FEED"
        icon="🏘️"
        currentPage="feed"
      />

      {/* Content - optimized for narrow screens */}
      <div className="mx-auto max-w-2xl px-3 py-4 sm:px-8 sm:py-8">
        <MomentList />
      </div>
    </main>
  );
}
