import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const AGENT_NAMES: Record<string, { name: string; role: string }> = {
  secretary: { name: "刘亦菲", role: "首席秘书官" },
  cto: { name: "扫地僧", role: "首席技术官" },
  "dev-lead": { name: "韦小宝", role: "研发主管" },
  cpo: { name: "乔布斯", role: "首席产品官" },
  uiux: { name: "高圆圆", role: "UI/UX 设计师" },
  cmo: { name: "达达里奥", role: "首席营销官" },
  culture: { name: "李子柒", role: "文化顾问" },
  hardware: { name: "马斯克", role: "硬件专家" },
  advisor: { name: "巴菲特", role: "战略顾问" },
};

function extractEventSummary(eventType: string, payload: Record<string, unknown> | null): string {
  if (!eventType) return "未知操作";

  switch (eventType) {
    case "sessions_spawn": {
      const task = payload?.task as string;
      if (task) {
        return `正在派发任务: ${task.slice(0, 50)}${task.length > 50 ? "..." : ""}`;
      }
      const target = payload?.agentId || payload?.target || "子任务";
      return `派发任务给 ${target}`;
    }
    case "tool_call":
    case "toolResult": {
      const toolName = (payload?.name || payload?.tool || "unknown") as string;
      return `正在执行: ${toolName}`;
    }
    case "message": {
      // OpenClaw JSONL 结构: payload.message.role, payload.message.content
      const msg = payload?.message as { role?: string; content?: unknown } | undefined;
      const role = msg?.role || payload?.role as string;
      
      // content 可能是字符串或数组
      let content: string = '';
      const rawContent = msg?.content || payload?.content;
      if (typeof rawContent === 'string') {
        content = rawContent;
      } else if (Array.isArray(rawContent)) {
        // content: [{type: "text", text: "..."}]
        const textItem = rawContent.find((item: unknown) => (item as { type?: string })?.type === 'text');
        content = (textItem as { text?: string })?.text || '';
      }
      
      if (role === "user") {
        if (content) return `收到消息: ${content.slice(0, 50)}${content.length > 50 ? "..." : ""}`;
        return "收到消息";
      }
      if (role === "assistant") {
        if (content) return `正在回复: ${content.slice(0, 50)}${content.length > 50 ? "..." : ""}`;
        return "回复消息";
      }
      return "消息处理中";
    }
    case "tool_result": {
      const tool = payload?.tool || payload?.name || "";
      const result = payload?.result as string;
      if (tool) return `${tool} 完成`;
      if (result) return result.slice(0, 80) + (result.length > 80 ? "..." : "");
      return "工具执行完成";
    }
    case "file_write":
    case "code_edit": {
      const file = (payload?.path || payload?.file || "文件") as string;
      return `正在编辑: ${file}`;
    }
    case "exec": {
      const command = payload?.command as string;
      if (command) return `正在执行命令: ${command.slice(0, 30)}${command.length > 30 ? "..." : ""}`;
      return "执行命令";
    }
    case "gh_pr_create":
    case "gh_pr_merge": {
      const title = payload?.title as string;
      const url = payload?.url as string;
      if (title) return `正在处理 PR: ${title}`;
      if (url) return `正在处理 PR: ${url}`;
      return "处理 PR";
    }
    case "thinking":
      return "思考中...";
    case "assistant_message": {
      const content = payload?.content as string;
      if (content) return content.slice(0, 100) + (content.length > 100 ? "..." : "");
      return "生成回复";
    }
    case "web_search": {
      const query = payload?.query as string;
      if (query) return `正在搜索: ${query.slice(0, 40)}${query.length > 40 ? "..." : ""}`;
      return "网络搜索";
    }
    case "web_fetch": {
      const url = payload?.url as string;
      if (url) return `正在获取: ${url.slice(0, 40)}${url.length > 40 ? "..." : ""}`;
      return "获取网页";
    }
    case "read":
    case "file_read": {
      const path = (payload?.path || payload?.file_path) as string;
      if (path) return `正在读取: ${path}`;
      return "读取文件";
    }
    default: {
      // 尝试从 payload 提取有意义的信息
      const summary = payload?.summary as string;
      const description = payload?.description as string;
      if (summary) return summary.slice(0, 80);
      if (description) return description.slice(0, 80);
      return `执行 ${eventType}`;
    }
  }
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params;
    const supabase = await createClient();
    const now = new Date();
    const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000).toISOString();
    const thirtyMinAgo = new Date(now.getTime() - 30 * 60 * 1000).toISOString();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

    // Fetch recent 10 events for this agent
    const { data: recentEvents, error: eventsError } = await supabase
      .from("events")
      .select("event_type, payload, created_at")
      .eq("agent_id", agentId)
      .order("created_at", { ascending: false })
      .limit(10);

    if (eventsError) {
      console.error("[api/agents/detail] Events error:", eventsError.message);
      return NextResponse.json({ error: "Failed to fetch events" }, { status: 500 });
    }

    const events = recentEvents as Array<{ event_type: string; payload: unknown; created_at: string }> | null;

    // Fetch today's events for stats
    const { data: todayEventsRaw, error: todayError } = await supabase
      .from("events")
      .select("event_type, created_at")
      .eq("agent_id", agentId)
      .gte("created_at", todayStart);

    if (todayError) {
      console.error("[api/agents/detail] Today events error:", todayError.message);
    }

    const todayEvents = todayEventsRaw as Array<{ event_type: string; created_at: string }> | null;

    // Fetch latest moment
    const { data: momentsRaw, error: momentsError } = await supabase
      .from("moments")
      .select("content, created_at")
      .eq("agent_id", agentId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (momentsError) {
      console.error("[api/agents/detail] Moments error:", momentsError.message);
    }

    const moments = momentsRaw as Array<{ content: string; created_at: string }> | null;

    // Determine status
    let status: "online" | "idle" | "offline" = "offline";
    const latestEvent = events?.[0];
    if (latestEvent) {
      if (latestEvent.created_at >= fiveMinAgo) {
        status = "online";
      } else if (latestEvent.created_at >= thirtyMinAgo) {
        status = "idle";
      }
    }

    // Extract current task from latest event
    let currentTask = "";
    if (status === "online" && latestEvent) {
      currentTask = extractEventSummary(
        latestEvent.event_type,
        latestEvent.payload as Record<string, unknown> | null
      );
    }

    // Calculate today stats
    const todayStats = {
      total: todayEvents?.length || 0,
      byType: {} as Record<string, number>,
    };
    for (const ev of todayEvents || []) {
      todayStats.byType[ev.event_type] = (todayStats.byType[ev.event_type] || 0) + 1;
    }

    // Format recent events
    const formattedEvents = (events || []).map((ev) => ({
      type: ev.event_type,
      summary: extractEventSummary(ev.event_type, ev.payload as Record<string, unknown> | null),
      time: formatTime(ev.created_at),
    }));

    // Format latest moment
    const latestMoment = moments?.[0]
      ? {
          content: moments[0].content,
          time: formatTime(moments[0].created_at),
        }
      : null;

    // Get agent name and role
    const agentInfo = AGENT_NAMES[agentId] || { name: agentId, role: "Agent" };

    return NextResponse.json({
      agent_id: agentId,
      name: agentInfo.name,
      role: agentInfo.role,
      status,
      currentTask,
      todayStats,
      recentEvents: formattedEvents,
      latestMoment,
    });
  } catch (err) {
    console.error("[api/agents/detail] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
