/**
 * Next.js Instrumentation Hook
 * Runs once when the server process starts (not on every request).
 * Used here to auto-start the Watcher service.
 */
export async function register() {
  // Only run on the Node.js server runtime, not on Edge or client
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { watcherService } = await import("./lib/watcher");
    try {
      await watcherService.start();
      console.log("[instrumentation] Watcher auto-started successfully");
    } catch (err) {
      // Already running or failed — log but don't crash the server
      console.warn("[instrumentation] Watcher start skipped:", err instanceof Error ? err.message : err);
    }
  }
}
