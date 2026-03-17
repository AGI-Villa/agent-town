import { NextResponse } from "next/server";
import { getGatewayStatus, checkForUpdates, getRecentLogs } from "@/lib/openclaw-gateway";

export const dynamic = "force-dynamic";

/**
 * GET /api/gateway
 * 
 * Returns the current OpenClaw Gateway status including:
 * - Running state and PID
 * - Version information
 * - Connected agents count
 * - Channel status
 * - Recent warnings
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const includeUpdates = searchParams.get("updates") === "true";
    const includeLogs = searchParams.get("logs") === "true";
    const logLines = parseInt(searchParams.get("logLines") || "50", 10);

    // Get gateway status
    const status = await getGatewayStatus();

    // Optionally check for updates
    let updateStatus = null;
    if (includeUpdates) {
      updateStatus = await checkForUpdates();
    }

    // Optionally get recent logs
    let logs = null;
    if (includeLogs) {
      const logResult = await getRecentLogs(logLines);
      logs = logResult;
    }

    return NextResponse.json({
      status,
      updateStatus,
      logs,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[api/gateway] Error:", err);
    return NextResponse.json(
      { error: "Failed to get gateway status" },
      { status: 500 }
    );
  }
}
