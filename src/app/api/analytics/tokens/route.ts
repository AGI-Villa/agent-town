import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/database.types";

type Period = "day" | "week" | "month";
type TokenUsageRow = Database["public"]["Tables"]["token_usage"]["Row"];

function getPeriodStart(period: Period): Date {
  const now = new Date();
  switch (period) {
    case "day":
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    case "week":
      const dayOfWeek = now.getDay();
      const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      return new Date(now.getFullYear(), now.getMonth(), diff);
    case "month":
      return new Date(now.getFullYear(), now.getMonth(), 1);
    default:
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const agentId = searchParams.get("agent_id");
  const period = (searchParams.get("period") || "day") as Period;

  const client = getAdminClient();
  const periodStart = getPeriodStart(period);

  try {
    // Build base query
    let query = client
      .from("token_usage")
      .select("*")
      .gte("created_at", periodStart.toISOString())
      .order("created_at", { ascending: false });

    if (agentId) {
      query = query.eq("agent_id", agentId);
    }

    const { data: usageData, error } = await query;

    if (error) {
      console.error("[analytics/tokens] Query error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const records = (usageData || []) as TokenUsageRow[];

    // Calculate summary
    const summary = {
      total_tokens: 0,
      total_cost: 0,
      prompt_tokens: 0,
      completion_tokens: 0,
      period,
    };

    // Group by agent
    const byAgentMap = new Map<string, { tokens: number; cost: number }>();

    // Group by date for trend
    const trendMap = new Map<string, { tokens: number; cost: number }>();

    for (const record of records) {
      summary.total_tokens += record.total_tokens || 0;
      summary.prompt_tokens += record.prompt_tokens || 0;
      summary.completion_tokens += record.completion_tokens || 0;
      summary.total_cost += Number(record.estimated_cost) || 0;

      // By agent
      const agentStats = byAgentMap.get(record.agent_id) || { tokens: 0, cost: 0 };
      agentStats.tokens += record.total_tokens || 0;
      agentStats.cost += Number(record.estimated_cost) || 0;
      byAgentMap.set(record.agent_id, agentStats);

      // By date
      const dateKey = new Date(record.created_at).toISOString().split("T")[0];
      const dateStats = trendMap.get(dateKey) || { tokens: 0, cost: 0 };
      dateStats.tokens += record.total_tokens || 0;
      dateStats.cost += Number(record.estimated_cost) || 0;
      trendMap.set(dateKey, dateStats);
    }

    // Convert maps to arrays
    const by_agent = Array.from(byAgentMap.entries())
      .map(([agent_id, stats]) => ({
        agent_id,
        tokens: stats.tokens,
        cost: Math.round(stats.cost * 1000000) / 1000000,
      }))
      .sort((a, b) => b.tokens - a.tokens);

    const trend = Array.from(trendMap.entries())
      .map(([date, stats]) => ({
        date,
        tokens: stats.tokens,
        cost: Math.round(stats.cost * 1000000) / 1000000,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({
      summary: {
        ...summary,
        total_cost: Math.round(summary.total_cost * 1000000) / 1000000,
      },
      by_agent,
      trend,
    });
  } catch (err) {
    console.error("[analytics/tokens] Error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
