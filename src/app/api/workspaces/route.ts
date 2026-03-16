import { NextResponse } from "next/server";
import { getAllWorkspaces, getWorkspaceConfig } from "@/lib/workspace";

export async function GET() {
  try {
    const config = getWorkspaceConfig();
    const workspaces = getAllWorkspaces();

    return NextResponse.json({
      workspaces,
      defaultWorkspaceId: config.defaultWorkspaceId,
    });
  } catch (err) {
    console.error("[api/workspaces] Error:", err);
    return NextResponse.json({ error: "Failed to fetch workspaces" }, { status: 500 });
  }
}
