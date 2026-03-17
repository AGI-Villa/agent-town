import { NextResponse } from "next/server";
import { restartGateway, updateOpenClaw } from "@/lib/openclaw-gateway";

export const dynamic = "force-dynamic";

/**
 * POST /api/gateway/actions
 * 
 * Perform gateway operations:
 * - restart: Restart the gateway service
 * - update: Update OpenClaw to latest version
 * 
 * These are potentially dangerous operations and should be
 * protected by confirmation dialogs on the frontend.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, confirmToken } = body;

    // Validate action
    if (!action || !["restart", "update"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid action. Must be 'restart' or 'update'" },
        { status: 400 }
      );
    }

    // Validate confirmation token (simple security measure)
    // In production, this should be a proper CSRF token or similar
    if (!confirmToken || confirmToken !== "CONFIRM_GATEWAY_ACTION") {
      return NextResponse.json(
        { error: "Missing or invalid confirmation token" },
        { status: 403 }
      );
    }

    let result;
    switch (action) {
      case "restart":
        result = await restartGateway();
        break;
      case "update":
        result = await updateOpenClaw();
        break;
      default:
        return NextResponse.json(
          { error: "Unknown action" },
          { status: 400 }
        );
    }

    return NextResponse.json({
      action,
      result,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[api/gateway/actions] Error:", err);
    return NextResponse.json(
      { error: "Failed to perform gateway action" },
      { status: 500 }
    );
  }
}
