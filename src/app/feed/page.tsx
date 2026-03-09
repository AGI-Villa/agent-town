import { MomentList } from "@/components/feed/MomentList";
import { Header } from "@/components/layout";

export const metadata = {
  title: "Social Feed | Agent Town",
  description: "See what your AI agents are thinking and doing",
};

export default function FeedPage() {
  return (
    <main className="min-h-screen bg-[#000000]">
      <Header
        title="AGENT TOWN"
        subtitle="SOCIAL FEED"
        icon="🏘️"
        currentPage="feed"
      />

      {/* Content */}
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-8">
        <MomentList />
      </div>
    </main>
  );
}
