import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";
import type { AgentStatus } from "@/lib/types";

type EventRow = Database["public"]["Tables"]["events"]["Row"];

export async function GET() {
  try {
    const supabase = await createClient();
    const now = new Date();
    const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000).toISOString();
    const thirtyMinAgo = new Date(now.getTime() - 30 * 60 * 1000).toISOString();
    const twentyFourHAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

    // Get all events in last 24h
    const { data: allEventsRaw, error } = await supabase
      .from("events")
      .select("agent_id, event_type, created_at")
      .gte("created_at", twentyFourHAgo)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: "Failed to fetch agents" }, { status: 500 });
    }

    const events = (allEventsRaw ?? []) as Pick<EventRow, "agent_id" | "event_type" | "created_at">[];

    // Group by agent
    const agentMap = new Map<
      string,
      { lastAt: string; lastType: string; count: number }
    >();

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

    // Also check for agents with older events (not in 24h window)
    const { data: olderAgentsRaw } = await supabase
      .from("events")
      .select("agent_id")
      .lt("created_at", twentyFourHAgo);

    const olderAgents = (olderAgentsRaw ?? []) as Pick<EventRow, "agent_id">[];
    for (const ev of olderAgents) {
      if (!agentMap.has(ev.agent_id)) {
        agentMap.set(ev.agent_id, {
          lastAt: "",
          lastType: "",
          count: 0,
        });
      }
    }

    const agents: AgentStatus[] = [];

    for (const [agentId, info] of agentMap) {
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

    // Sort: online first, then idle, then offline
    const statusOrder = { online: 0, idle: 1, offline: 2 };
    agents.sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);

    return NextResponse.json(agents);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
