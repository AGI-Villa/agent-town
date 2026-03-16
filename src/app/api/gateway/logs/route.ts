import { NextRequest, NextResponse } from "next/server";
import { getRecentLogs, getErrorLogs } from "@/lib/openclaw-gateway";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "recent";
    const lines = parseInt(searchParams.get("lines") || "50", 10);

    const logs = type === "errors" 
      ? await getErrorLogs(Math.min(lines, 100))
      : await getRecentLogs(Math.min(lines, 200));

    return NextResponse.json({ logs });
  } catch (error) {
    console.error("[gateway/logs] Error:", error);
    return NextResponse.json(
      { error: "Failed to get logs" },
      { status: 500 }
    );
  }
}
