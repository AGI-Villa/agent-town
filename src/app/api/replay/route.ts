import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAgentName, getAgentRole } from "@/lib/agents";

// Event type icons
const EVENT_ICONS: Record<string, string> = {
  message: "💬",
  tool_call: "🔧",
  tool_result: "⚙️",
  thinking: "💭",
  sessions_spawn: "🚀",
  code_edit: "📝",
  file_write: "📝",
  assistant_message: "💬",
};

// Skip low-value agents
const SKIP_AGENTS = new Set(["test-agent", "agent-001", "sync-agent", "main"]);

interface MessagePayload {
  message?: {
    role?: string;
    content?: string | Array<{ type: string; text?: string }>;
  };
  tool?: string;
  name?: string;
  result?: string;
  agentId?: string;
  target?: string;
  file?: string;
  path?: string;
}

function extractEventSummary(eventType: string, payload: MessagePayload | null): string | null {
  if (!eventType) return null;

  switch (eventType) {
    case "message": {
      if (!payload?.message) return null;
      const { role, content } = payload.message;
      
      let text = "";
      if (typeof content === "string") {
        text = content;
      } else if (Array.isArray(content)) {
        text = content
          .filter((c) => c.type === "text" && c.text)
          .map((c) => c.text!)
          .join("\n");
      }

      if (!text || text.length < 10) return null;
      
      const cleaned = text
        .replace(/<relevant-memories>[\s\S]*?<\/relevant-memories>/g, "")
        .replace(/\[.*?\]/g, "")
        .trim();
      
      if (cleaned.length < 10) return null;

      if (role === "assistant") {
        return cleaned.slice(0, 150) + (cleaned.length > 150 ? "..." : "");
      }
      if (role === "user") {
        return `Darren: ${cleaned.slice(0, 120)}${cleaned.length > 120 ? "..." : ""}`;
      }
      return null;
    }

    case "tool_call": {
      const tool = payload?.tool || payload?.name || "工具";
      return `调用 ${tool}`;
    }

    case "tool_result": {
      const tool = payload?.tool || payload?.name || "";
      if (tool) return `${tool} 执行完成`;
      return "工具执行完成";
    }

    case "sessions_spawn": {
      const target = payload?.agentId || payload?.target || "子任务";
      return `派发任务给 ${target}`;
    }

    case "code_edit":
    case "file_write": {
      const file = payload?.file || payload?.path || "文件";
      return `编辑 ${file}`;
    }

    case "thinking":
      return "思考中...";

    case "assistant_message": {
      const content = payload?.message?.content;
      if (typeof content === "string" && content.length > 10) {
        return content.slice(0, 150) + (content.length > 150 ? "..." : "");
      }
      return "生成回复";
    }

    default:
      return `执行 ${eventType}`;
  }
}

export interface ReplayEvent {
  id: string;
  agent_id: string;
  agent_name: string;
  agent_role: string;
  event_type: string;
  icon: string;
  summary: string;
  timestamp: string; // ISO string
  game_hour: number; // 0-23
  game_minute: number; // 0-59
}

export interface ReplayMoment {
  id: string;
  agent_id: string;
  agent_name: string;
  content: string;
  emotion: string | null;
  timestamp: string;
  game_hour: number;
  game_minute: number;
}

export interface ReplayData {
  date: string;
  events: ReplayEvent[];
  moments: ReplayMoment[];
  agents: { id: string; name: string }[];
  hasData: boolean;
}

/**
 * GET /api/replay?date=YYYY-MM-DD
 * Returns all events and moments for a specific day, sorted by time.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get("date");

    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return NextResponse.json(
        { error: "Invalid date format. Use YYYY-MM-DD" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Date range for the selected day (UTC)
    const startDate = `${dateStr}T00:00:00Z`;
    const endDate = `${dateStr}T23:59:59.999Z`;

    // Fetch events for the day
    const { data: eventsRaw, error: eventsError } = await supabase
      .from("events")
      .select("id, agent_id, event_type, payload, created_at")
      .gte("created_at", startDate)
      .lte("created_at", endDate)
      .order("created_at", { ascending: true });

    if (eventsError) {
      console.error("[api/replay] Events error:", eventsError.message);
      return NextResponse.json({ error: "Failed to fetch events" }, { status: 500 });
    }

    // Fetch moments for the day
    const { data: momentsRaw, error: momentsError } = await supabase
      .from("moments")
      .select("id, agent_id, content, emotion, created_at")
      .gte("created_at", startDate)
      .lte("created_at", endDate)
      .order("created_at", { ascending: true });

    if (momentsError) {
      console.error("[api/replay] Moments error:", momentsError.message);
      return NextResponse.json({ error: "Failed to fetch moments" }, { status: 500 });
    }

    // Type assertions for the raw data
    const typedEvents = eventsRaw as Array<{
      id: string;
      agent_id: string;
      event_type: string;
      payload: unknown;
      created_at: string;
    }> | null;

    const typedMoments = momentsRaw as Array<{
      id: string;
      agent_id: string;
      content: string;
      emotion: string | null;
      created_at: string;
    }> | null;

    // Process events
    const events: ReplayEvent[] = [];
    const agentIds = new Set<string>();

    for (const ev of typedEvents || []) {
      if (SKIP_AGENTS.has(ev.agent_id)) continue;

      const summary = extractEventSummary(ev.event_type, ev.payload as MessagePayload | null);
      if (!summary) continue;

      const date = new Date(ev.created_at);
      agentIds.add(ev.agent_id);

      events.push({
        id: ev.id,
        agent_id: ev.agent_id,
        agent_name: getAgentName(ev.agent_id),
        agent_role: getAgentRole(ev.agent_id) ?? "Agent",
        event_type: ev.event_type,
        icon: EVENT_ICONS[ev.event_type] || "📋",
        summary,
        timestamp: ev.created_at,
        game_hour: date.getUTCHours(),
        game_minute: date.getUTCMinutes(),
      });
    }

    // Process moments
    const moments: ReplayMoment[] = [];

    for (const m of typedMoments || []) {
      const date = new Date(m.created_at);
      agentIds.add(m.agent_id);

      moments.push({
        id: m.id,
        agent_id: m.agent_id,
        agent_name: getAgentName(m.agent_id),
        content: m.content,
        emotion: m.emotion,
        timestamp: m.created_at,
        game_hour: date.getUTCHours(),
        game_minute: date.getUTCMinutes(),
      });
    }

    // Build agent list
    const agents = Array.from(agentIds)
      .filter((id) => !SKIP_AGENTS.has(id))
      .map((id) => ({
        id,
        name: getAgentName(id),
      }));

    const response: ReplayData = {
      date: dateStr,
      events,
      moments,
      agents,
      hasData: events.length > 0 || moments.length > 0,
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error("[api/replay] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
