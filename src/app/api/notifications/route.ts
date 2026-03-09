import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/database.types";

export const dynamic = "force-dynamic";

type Notification = Database["public"]["Tables"]["notifications"]["Row"];

/**
 * GET /api/notifications
 * Returns unread notifications with agent info.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10), 100);
  const includeRead = searchParams.get("includeRead") === "true";

  const client = getAdminClient();

  let query = client
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (!includeRead) {
    query = query.eq("read", false);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[notifications] Failed to fetch:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const notifications = (data ?? []) as Notification[];

  return NextResponse.json({
    notifications,
    unreadCount: notifications.filter((n) => !n.read).length,
  });
}
