/**
 * Next.js Instrumentation Hook
 * Runs once when the server process starts (not on every request).
 * Used here to auto-start the Watcher service and daily moment scheduler.
 */

let dailySchedulerStarted = false;

/**
 * Schedule daily moment generation at UTC 14:00 (Beijing 22:00).
 */
async function startDailyMomentScheduler() {
  if (dailySchedulerStarted) return;
  dailySchedulerStarted = true;

  const scheduleNext = () => {
    const now = new Date();
    const targetHourUTC = 14; // UTC 14:00 = Beijing 22:00

    // Calculate next run time
    const next = new Date(now);
    next.setUTCHours(targetHourUTC, 0, 0, 0);

    // If we've passed today's target time, schedule for tomorrow
    if (now >= next) {
      next.setUTCDate(next.getUTCDate() + 1);
    }

    const msUntilNext = next.getTime() - now.getTime();
    console.log(
      `[daily-moments] Next generation scheduled for ${next.toISOString()} (in ${Math.round(msUntilNext / 1000 / 60)} minutes)`
    );

    setTimeout(async () => {
      await triggerDailyGeneration();
      scheduleNext(); // Schedule the next day
    }, msUntilNext);
  };

  scheduleNext();
  console.log("[daily-moments] Scheduler started");
}

/**
 * Trigger the daily moment generation API.
 */
async function triggerDailyGeneration() {
  const today = new Date().toISOString().split("T")[0];
  console.log(`[daily-moments] Triggering generation for ${today}`);

  try {
    // Use internal fetch to call the API route
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const response = await fetch(`${baseUrl}/api/moments/generate-daily`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: today }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      console.error(`[daily-moments] Generation failed (${response.status}): ${errorText}`);
      return;
    }

    const result = await response.json();
    console.log(
      `[daily-moments] Generation complete: ${result.generated}/${result.total} moments created`
    );
  } catch (err) {
    console.error(
      "[daily-moments] Generation error:",
      err instanceof Error ? err.message : err
    );
  }
}

export async function register() {
  // Only run on the Node.js server runtime, not on Edge or client
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Start the watcher service
    const { watcherService } = await import("./lib/watcher");
    try {
      await watcherService.start();
      console.log("[instrumentation] Watcher auto-started successfully");
    } catch (err) {
      // Already running or failed — log but don't crash the server
      console.warn("[instrumentation] Watcher start skipped:", err instanceof Error ? err.message : err);
    }

    // Start the daily moment scheduler
    try {
      await startDailyMomentScheduler();
    } catch (err) {
      console.warn("[instrumentation] Daily scheduler start failed:", err instanceof Error ? err.message : err);
    }
  }
}
