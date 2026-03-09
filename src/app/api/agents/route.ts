import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";
import type { AgentStatus } from "@/lib/types";

type EventRow = Database["public"]["Tables"]["events"]["Row"];

export async function GET() {
  try {
    const supabase = await createClient();
    const now = new Date();
    const fiveMinAgo  = new Date(now.getTime() -  5 * 60 * 1000).toISOString();
    const thirtyMinAgo = new Date(now.getTime() - 30 * 60 * 1000).toISOString();
    const twentyFourHAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

    // Fetch all events from the last 24h, ordered newest first
    const { data: recentRaw, error } = await supabase
      .from("events")
      .select("agent_id, event_type, created_at")
      .gte("created_at", twentyFourHAgo)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[api/agents] Supabase error:", error.message);
      return NextResponse.json({ error: "Failed to fetch agents" }, { status: 500 });
    }

    const events = (recentRaw ?? []) as Pick<EventRow, "agent_id" | "event_type" | "created_at">[];

    // Build a per-agent summary: latest event time + last event type + 24h count
    const agentMap = new Map<string, { lastAt: string; lastType: string; count: number }>();

    for (const ev of events) {
      const existing = agentMap.get(ev.agent_id);
      if (!existing) {
        agentMap.set(ev.agent_id, {
          lastAt: ev.created_at,
          lastType: ev.event_type,
          count: 1,
        });
      } else {
        existing.count++;
      }
    }

    // Also surface agents that have events older than 24h (so they show as OFFLINE)
    const { data: olderRaw } = await supabase
      .from("events")
      .select("agent_id")
      .lt("created_at", twentyFourHAgo)
      .limit(200);

    for (const ev of (olderRaw ?? []) as Pick<EventRow, "agent_id">[]) {
      if (!agentMap.has(ev.agent_id)) {
        agentMap.set(ev.agent_id, { lastAt: "", lastType: "", count: 0 });
      }
    }

    // Determine status from recency of last event
    const agents: AgentStatus[] = [];

    for (const [agentId, info] of agentMap) {
      // Skip internal test agent
      if (agentId === "test-agent") continue;

      let status: "online" | "idle" | "offline" = "offline";
      if (info.lastAt && info.lastAt >= fiveMinAgo) {
        status = "online";
      } else if (info.lastAt && info.lastAt >= thirtyMinAgo) {
        status = "idle";
      }

      agents.push({
        agent_id: agentId,
        status,
        last_event_at: info.lastAt || null,
        event_count_24h: info.count,
        last_event_type: info.lastType || null,
      });
    }

    const statusOrder = { online: 0, idle: 1, offline: 2 };
    agents.sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);

    return NextResponse.json(agents);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
