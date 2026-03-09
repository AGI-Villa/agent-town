import { EventTimeline } from "@/components/timeline";
import { Header } from "@/components/layout";

export const metadata = {
  title: "Event Timeline | Agent Town",
  description: "Real-time observability of all agent activities",
};

export default function TimelinePage() {
  return (
    <main className="min-h-screen bg-[#000000]">
      <Header
        title="AGENT TOWN"
        subtitle="EVENT TIMELINE"
        icon="📊"
        currentPage="timeline"
      />

      {/* Content */}
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-8">
        <EventTimeline />
      </div>
    </main>
  );
}
