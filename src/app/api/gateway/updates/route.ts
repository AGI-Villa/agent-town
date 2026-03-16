import { NextResponse } from "next/server";
import { checkForUpdates } from "@/lib/openclaw-gateway";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const updateInfo = await checkForUpdates();
    return NextResponse.json(updateInfo);
  } catch (error) {
    console.error("[gateway/updates] Error:", error);
    return NextResponse.json(
      { error: "Failed to check for updates" },
      { status: 500 }
    );
  }
}
