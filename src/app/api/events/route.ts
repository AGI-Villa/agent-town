import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const AGENT_NAMES: Record<string, { name: string; role: string }> = {
  secretary: { name: "刘亦菲", role: "首席秘书��" },
  cto: { name: "扫地僧", role: "首席技术官" },
  "dev-lead": { name: "韦小宝", role: "研发主管" },
  cpo: { name: "乔布斯", role: "首席产品官" },
  uiux: { name: "高圆圆", role: "UI/UX 设计师" },
  cmo: { name: "达达里奥", role: "首席营销官" },
  culture: { name: "李子柒", role: "文化顾问" },
  hardware: { name: "马斯克", role: "硬件专家" },
  advisor: { name: "巴菲特", role: "战略顾问" },
};

// Skip low-value agents
const SKIP_AGENTS = new Set(["test-agent", "agent-001", "sync-agent", "main"]);

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

      // Skip system prompts and very short messages
      if (!text || text.length < 10) return null;
      
      // Strip system prompt preambles
      const cleaned = text
        .replace(/<relevant-memories>[\s\S]*?<\/relevant-memories>/g, "")
        .replace(/\[.*?\]/g, "") // Remove bracketed content
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
      const result = payload?.result;
      if (tool) return `${tool} 执行完成`;
      if (result && typeof result === "string") {
        return result.slice(0, 100) + (result.length > 100 ? "..." : "");
      }
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

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "刚刚";
  if (diffMin < 60) return `${diffMin}分钟前`;
  if (diffHour < 24) return `${diffHour}小时前`;
  if (diffDay === 1) return "昨天";
  if (diffDay < 7) return `${diffDay}天前`;
  return date.toLocaleDateString("zh-CN");
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get("agent_id");
    const dateFilter = searchParams.get("date"); // today, yesterday, week, or ISO date
    const offset = parseInt(searchParams.get("offset") || "0", 10);
    const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 50);

    const supabase = await createClient();
    const now = new Date();

    // Calculate date range
    let startDate: string | null = null;
    let endDate: string | null = null;

    if (dateFilter === "today") {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    } else if (dateFilter === "yesterday") {
      const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      startDate = yesterday.toISOString();
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    } else if (dateFilter === "week") {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    } else if (dateFilter) {
      // Assume ISO date like "2026-03-09"
      startDate = `${dateFilter}T00:00:00Z`;
      endDate = `${dateFilter}T23:59:59Z`;
    }

    // Build query
    let query = supabase
      .from("events")
      .select("id, agent_id, event_type, payload, created_at")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (agentId) {
      query = query.eq("agent_id", agentId);
    }

    if (startDate) {
      query = query.gte("created_at", startDate);
    }

    if (endDate) {
      query = query.lte("created_at", endDate);
    }

    const { data: eventsRaw, error } = await query;

    if (error) {
      console.error("[api/events] Supabase error:", error.message);
      return NextResponse.json({ error: "Failed to fetch events" }, { status: 500 });
    }

    const events = eventsRaw as Array<{
      id: string;
      agent_id: string;
      event_type: string;
      payload: unknown;
      created_at: string;
    }> | null;

    // Process events
    const processedEvents = [];
    for (const ev of events || []) {
      // Skip low-value agents
      if (SKIP_AGENTS.has(ev.agent_id)) continue;

      const summary = extractEventSummary(ev.event_type, ev.payload as MessagePayload | null);
      
      // Skip events without meaningful summary
      if (!summary) continue;

      const agentInfo = AGENT_NAMES[ev.agent_id] || { name: ev.agent_id, role: "Agent" };

      processedEvents.push({
        id: ev.id,
        agent_id: ev.agent_id,
        agent_name: agentInfo.name,
        agent_role: agentInfo.role,
        event_type: ev.event_type,
        icon: EVENT_ICONS[ev.event_type] || "📋",
        summary,
        time: formatRelativeTime(ev.created_at),
        created_at: ev.created_at,
      });
    }

    // Get available agents for filter
    const { data: agentListRaw } = await supabase
      .from("events")
      .select("agent_id")
      .order("created_at", { ascending: false })
      .limit(500);

    const agentList = agentListRaw as Array<{ agent_id: string }> | null;

    const uniqueAgents = [...new Set((agentList || []).map((e) => e.agent_id))]
      .filter((id) => !SKIP_AGENTS.has(id))
      .map((id) => ({
        id,
        name: AGENT_NAMES[id]?.name || id,
      }));

    return NextResponse.json({
      events: processedEvents,
      agents: uniqueAgents,
      hasMore: (events?.length || 0) >= limit,
    });
  } catch (err) {
    console.error("[api/events] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
