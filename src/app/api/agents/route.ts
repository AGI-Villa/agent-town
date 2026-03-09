import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { readdir, stat } from "fs/promises";
import { resolve } from "path";
import type { Database } from "@/lib/database.types";
import type { AgentStatus, TaskInfo } from "@/lib/types";
import { getAgentsDir } from "@/lib/openclaw-discovery";

type EventRow = Database["public"]["Tables"]["events"]["Row"];

const SKIP_AGENTS = new Set(["test-agent", "agent-001", "sync-agent", "main"]);

// Parse event payload to extract task description
function parseTaskFromEvent(eventType: string, payload: Record<string, unknown> | null, createdAt: string): TaskInfo | null {
  if (!eventType) return null;
  
  let description = "";
  
  switch (eventType) {
    case "sessions_spawn":
      const targetAgent = payload?.agentId || payload?.target || "子任务";
      description = `正在派发任务给 ${targetAgent}`;
      break;
    case "tool_call":
      const toolName = payload?.tool || payload?.name || "工具";
      description = `正在执行 ${toolName}`;
      break;
    case "message":
      description = "正在回复消息";
      break;
    case "code_edit":
    case "file_write":
      const filename = payload?.file || payload?.path || "文件";
      description = `正在编辑 ${filename}`;
      break;
    case "thinking":
      description = "正在思考...";
      break;
    case "tool_result":
      description = "正在处理工具结果";
      break;
    case "assistant_message":
      description = "正在生成回复";
      break;
    default:
      description = `正在执行 ${eventType}`;
  }
  
  return {
    description,
    started_at: createdAt,
  };
}

export async function GET() {
  try {
    const supabase = await createClient();
    const now = new Date();
    const fiveMinAgo  = new Date(now.getTime() -  5 * 60 * 1000).toISOString();
    const thirtyMinAgo = new Date(now.getTime() - 30 * 60 * 1000).toISOString();
    const twentyFourHAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

    // Fetch all events from the last 24h, ordered newest first, including payload
    const { data: recentRaw, error } = await supabase
      .from("events")
      .select("agent_id, event_type, created_at, payload")
      .gte("created_at", twentyFourHAgo)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[api/agents] Supabase error:", error.message);
      return NextResponse.json({ error: "Failed to fetch agents" }, { status: 500 });
    }

    const events = (recentRaw ?? []) as Pick<EventRow, "agent_id" | "event_type" | "created_at" | "payload">[];

    // Build a per-agent summary: latest event time + last event type + 24h count + task info
    const agentMap = new Map<string, { lastAt: string; lastType: string; count: number; payload: Record<string, unknown> | null }>();

    for (const ev of events) {
      const existing = agentMap.get(ev.agent_id);
      if (!existing) {
        agentMap.set(ev.agent_id, {
          lastAt: ev.created_at,
          lastType: ev.event_type,
          count: 1,
          payload: ev.payload as Record<string, unknown> | null,
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
        agentMap.set(ev.agent_id, { lastAt: "", lastType: "", count: 0, payload: null });
      }
    }

    // Discover agents from filesystem that may not have DB events yet
    try {
      const agentsDir = getAgentsDir();
      const entries = await readdir(agentsDir);
      for (const entry of entries) {
        if (entry.endsWith(".jsonl")) continue;
        const s = await stat(resolve(agentsDir, entry)).catch(() => null);
        if (s?.isDirectory() && !agentMap.has(entry) && !SKIP_AGENTS.has(entry)) {
          agentMap.set(entry, { lastAt: "", lastType: "", count: 0, payload: null });
        }
      }
    } catch { /* agents dir may not exist */ }

    const agents: AgentStatus[] = [];

    for (const [agentId, info] of agentMap) {
      if (SKIP_AGENTS.has(agentId)) continue;

      let status: "online" | "idle" | "offline";
      if (info.lastAt && info.lastAt >= fiveMinAgo) {
        status = "online";
      } else if (info.lastAt && info.lastAt >= thirtyMinAgo) {
        status = "idle";
      } else {
        status = "idle";
      }

      // Parse task info from latest event
      const currentTask = status === "online" 
        ? parseTaskFromEvent(info.lastType, info.payload, info.lastAt)
        : null;

      agents.push({
        agent_id: agentId,
        status,
        last_event_at: info.lastAt || null,
        event_count_24h: info.count,
        last_event_type: info.lastType || null,
        current_task: currentTask,
      });
    }

    const statusOrder = { online: 0, idle: 1, offline: 2 };
    agents.sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);

    return NextResponse.json(agents);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
