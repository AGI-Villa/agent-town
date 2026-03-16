import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceAgentIds } from "@/lib/workspace";
import type { Database } from "@/lib/database.types";

type Moment = Database["public"]["Tables"]["moments"]["Row"];
type Comment = Database["public"]["Tables"]["comments"]["Row"];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "20", 10), 1), 100);
    const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10), 0);
    const workspaceId = searchParams.get("workspace") ?? "default";

    // Get workspace agent filter
    const workspaceAgentIds = getWorkspaceAgentIds(workspaceId);

    const supabase = await createClient();

    let query = supabase
      .from("moments")
      .select("*")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    // Filter by workspace agents if workspace has specific agents
    if (workspaceAgentIds && workspaceAgentIds.length > 0) {
      query = query.in("agent_id", workspaceAgentIds);
    }

    const { data: momentsRaw, error: momentsError } = await query;

    if (momentsError) {
      return NextResponse.json({ error: "Failed to fetch moments" }, { status: 500 });
    }

    const moments = (momentsRaw ?? []) as Moment[];

    if (moments.length === 0) {
      return NextResponse.json([]);
    }

    // Fetch comments for all moments in one query
    const momentIds = moments.map((m) => m.id);
    const { data: commentsRaw, error: commentsError } = await supabase
      .from("comments")
      .select("*")
      .in("moment_id", momentIds)
      .order("created_at", { ascending: true });

    if (commentsError) {
      return NextResponse.json(moments.map((m) => ({ ...m, comments: [] })));
    }

    const comments = (commentsRaw ?? []) as Comment[];

    // Group comments by moment_id
    const commentsByMoment = new Map<string, Comment[]>();
    for (const comment of comments) {
      const existing = commentsByMoment.get(comment.moment_id) || [];
      existing.push(comment);
      commentsByMoment.set(comment.moment_id, existing);
    }

    const result = moments.map((m) => ({
      ...m,
      comments: commentsByMoment.get(m.id) || [],
    }));

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
