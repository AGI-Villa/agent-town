import { EventTimeline } from "@/components/timeline";
import { Header } from "@/components/layout";

export const metadata = {
  title: "Event Timeline | Agent Town",
  description: "Real-time observability of all agent activities",
};

export default function TimelinePage() {
  return (
    <main className="min-h-screen bg-[#000000] pb-mobile-nav">
      <Header
        title="AGENT TOWN"
        subtitle="EVENT TIMELINE"
        icon="📊"
        currentPage="timeline"
      />

      {/* Content - optimized for narrow screens */}
      <div className="mx-auto max-w-3xl px-3 py-4 sm:px-8 sm:py-8">
        <EventTimeline />
      </div>
    </main>
  );
}
