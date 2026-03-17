import { NextRequest, NextResponse } from "next/server";
import { getRecentLogs } from "@/lib/openclaw-gateway";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lines = parseInt(searchParams.get("lines") || "50", 10);

    const result = await getRecentLogs(Math.min(lines, 200));

    if (result.error) {
      return NextResponse.json({ logs: [], error: result.error }, { status: 500 });
    }

    return NextResponse.json({ logs: result.logs.split("\n").filter(Boolean) });
  } catch (error) {
    console.error("[gateway/logs] Error:", error);
    return NextResponse.json(
      { error: "Failed to get logs" },
      { status: 500 }
    );
  }
}
