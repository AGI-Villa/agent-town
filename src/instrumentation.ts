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
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (process.env.ADMIN_API_KEY) {
      headers["x-internal-token"] = process.env.ADMIN_API_KEY;
    }
    const response = await fetch(`${baseUrl}/api/moments/generate-daily`, {
      method: "POST",
      headers,
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

function printBanner() {
  const c = {
    reset: "\x1b[0m",
    dim: "\x1b[2m",
    green: "\x1b[32m",
    cyan: "\x1b[36m",
    yellow: "\x1b[33m",
    magenta: "\x1b[35m",
    bold: "\x1b[1m",
    white: "\x1b[37m",
  };

  const banner = `
${c.green}    ╭──────────────────────────────────────────────────╮
    │                                                  │
    │${c.cyan}${c.bold}       █████   ██████  ███████ ███    ██ ████████  ${c.green}│
    │${c.cyan}${c.bold}      ██   ██ ██       ██      ████   ██    ██     ${c.green}│
    │${c.cyan}${c.bold}      ███████ ██   ███ █████   ██ ██  ██    ██     ${c.green}│
    │${c.cyan}${c.bold}      ██   ██ ██    ██ ██      ██  ██ ██    ██     ${c.green}│
    │${c.cyan}${c.bold}      ██   ██  ██████  ███████ ██   ████    ██     ${c.green}│
    │${c.yellow}${c.bold}      ████████  ██████  ██     ██ ███    ██        ${c.green}│
    │${c.yellow}${c.bold}         ██    ██    ██ ██     ██ ████   ██        ${c.green}│
    │${c.yellow}${c.bold}         ██    ██    ██ ██  █  ██ ██ ██  ██        ${c.green}│
    │${c.yellow}${c.bold}         ██    ██    ██ ██ ███ ██ ██  ██ ██        ${c.green}│
    │${c.yellow}${c.bold}         ██     ██████   ███ ███  ██   ████        ${c.green}│
    │                                                  │
    │${c.dim}${c.white}    🏘️  Give your AI agents a life beyond the     ${c.green}│
    │${c.dim}${c.white}        terminal. Watch them live, work, and       ${c.green}│
    │${c.dim}${c.white}        share their thoughts in a pixel-art town.  ${c.green}│
    │                                                  │
    │${c.magenta}     ♟ ♟        🏠 🏡 🏢        🌳 🐱 🐕          ${c.green}│
    │                                                  │
    ╰──────────────────────────────────────────────────╯${c.reset}
`;

  console.log(banner);
}

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    printBanner();

    const { discoverAgents } = await import("./lib/openclaw-discovery");
    const agents = await discoverAgents();
    const active = [...agents.values()].filter((a) => a.hasSessionLogs);
    console.log(
      `\x1b[2m  📡 Discovered ${agents.size} agents (${active.length} active) from OpenClaw\x1b[0m`
    );

    const { watcherService } = await import("./lib/watcher");
    try {
      await watcherService.start();
      console.log("  \x1b[32m✓\x1b[0m Watcher started");
    } catch (err) {
      console.warn("  \x1b[33m⚠\x1b[0m Watcher:", err instanceof Error ? err.message : err);
    }

    try {
      await startDailyMomentScheduler();
      console.log("  \x1b[32m✓\x1b[0m Daily moment scheduler started");
    } catch (err) {
      console.warn("  \x1b[33m⚠\x1b[0m Scheduler:", err instanceof Error ? err.message : err);
    }

    console.log("");
  }
}
