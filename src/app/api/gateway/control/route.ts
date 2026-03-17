import { NextRequest, NextResponse } from "next/server";
import {
  restartGateway,
  stopGateway,
  startGateway,
  updateOpenClaw,
} from "@/lib/openclaw-gateway";

export const dynamic = "force-dynamic";

type ActionType = "restart" | "stop" | "start" | "upgrade";

const actionHandlers: Record<ActionType, () => Promise<{ success: boolean; message: string; error?: string | null }>> = {
  restart: restartGateway,
  stop: stopGateway,
  start: startGateway,
  upgrade: updateOpenClaw,
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, confirmToken } = body as { action: string; confirmToken?: string };

    // Validate action
    if (!action || !Object.keys(actionHandlers).includes(action)) {
      return NextResponse.json(
        { error: "Invalid action. Must be one of: restart, stop, start, upgrade" },
        { status: 400 }
      );
    }

    // For dangerous operations, require confirmation token
    const dangerousActions = ["upgrade", "stop"];
    if (dangerousActions.includes(action)) {
      if (!confirmToken || confirmToken !== "CONFIRM") {
        return NextResponse.json(
          { error: "Dangerous operation requires confirmation token" },
          { status: 400 }
        );
      }
    }

    const handler = actionHandlers[action as ActionType];
    const result = await handler();

    return NextResponse.json(result);
  } catch (error) {
    console.error("[gateway/control] Error:", error);
    return NextResponse.json(
      { error: "Failed to execute gateway control action" },
      { status: 500 }
    );
  }
}
