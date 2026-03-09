import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/notifications/[id]/read
 * Mark a notification as read.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: "Missing notification id" }, { status: 400 });
  }

  const client = getAdminClient();

  const { error } = await client
    .from("notifications")
    .update({ read: true })
    .eq("id", id);

  if (error) {
    console.error("[notifications] Failed to mark as read:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
