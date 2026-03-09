import { NextResponse } from "next/server";
import { watcherService } from "@/lib/watcher";

/**
 * GET /api/watcher — returns current watcher status
 */
export async function GET() {
  try {
    const status = watcherService.getStatus();
    return NextResponse.json(status);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/watcher — start or stop the watcher
 * Body: { "action": "start" | "stop" }
 */
export async function POST(request: Request) {
  const { requireAuth } = await import("@/lib/api-auth");
  const authError = requireAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const action = body?.action;

    if (action === "start") {
      await watcherService.start();
      return NextResponse.json({
        message: "Watcher started",
        status: watcherService.getStatus(),
      });
    }

    if (action === "stop") {
      await watcherService.stop();
      return NextResponse.json({
        message: "Watcher stopped",
        status: watcherService.getStatus(),
      });
    }

    return NextResponse.json({ error: 'Invalid action. Use "start" or "stop".' }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
