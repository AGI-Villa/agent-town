export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-4xl font-bold tracking-tight">Agent Town 🏘️</h1>
      <p className="max-w-md text-center text-lg text-muted-foreground">
        A Tamagotchi-style observability platform for your AI agents. Watch them work, read their
        thoughts, and interact with them.
      </p>
      <div className="flex gap-4">
        <span className="rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground">
          Phase 1: In Development
        </span>
      </div>
    </main>
  );
}
