import { NextResponse } from "next/server";
import { getGatewayStatus } from "@/lib/openclaw-gateway";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const status = await getGatewayStatus();
    return NextResponse.json(status);
  } catch (error) {
    console.error("[gateway/status] Error:", error);
    return NextResponse.json(
      { error: "Failed to get gateway status" },
      { status: 500 }
    );
  }
}
