import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateDailyDigest } from "@/lib/moments/generator";
import type { Database } from "@/lib/database.types";

type EventRow = Database["public"]["Tables"]["events"]["Row"];
type MomentInsert = Database["public"]["Tables"]["moments"]["Insert"];

const AGENT_NAMES: Record<string, string> = {
  secretary: "刘亦菲",
  cto: "扫地僧",
  "dev-lead": "韦小宝",
  cpo: "乔布斯",
  uiux: "高圆圆",
  cmo: "达达里奥",
  culture: "李子柒",
  hardware: "马斯克",
  advisor: "巴菲特",
};

const CORE_AGENTS = Object.keys(AGENT_NAMES);

interface MessagePayload {
  message?: {
    role?: string;
    content?: string | Array<{ type: string; text?: string }>;
  };
}

function extractTextFromEvent(event: EventRow): string | null {
  const payload = event.payload as MessagePayload | null;
  if (!payload?.message) return null;
  const { role, content } = payload.message;
  if (role !== "assistant" && role !== "user") return null;

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

  // Strip system prompt preambles (relevant-memories blocks, etc)
  const cleaned = text.replace(/<relevant-memories>[\s\S]*?<\/relevant-memories>/g, "").trim();
  if (cleaned.length < 10) return null;

  const label = role === "assistant" ? "我" : "Darren";
  return `${label}: ${cleaned}`;
}

/**
 * POST /api/moments/generate-daily
 *
 * For each core agent, aggregate today's conversation messages,
 * then generate ONE daily digest moment via LLM.
 *
 * Body (optional):
 *   { date?: string }  — ISO date string like "2026-03-09", defaults to today
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({})) as { date?: string };
    const targetDate = body.date ?? new Date().toISOString().split("T")[0];
    const dayStart = `${targetDate}T00:00:00Z`;
    const dayEnd = `${targetDate}T23:59:59Z`;

    const supabase = await createClient();
    const results: Array<{ agent_id: string; status: string; moment_id?: string }> = [];

    for (const agentId of CORE_AGENTS) {
      try {
        // Check if a digest moment already exists for this agent today
        const { data: existing } = await supabase
          .from("moments")
          .select("id")
          .eq("agent_id", agentId)
          .gte("created_at", dayStart)
          .lte("created_at", dayEnd)
          .limit(1);

        if (existing && existing.length > 0) {
          results.push({ agent_id: agentId, status: "skipped (already has moment today)" });
          continue;
        }

        // Fetch today's message events for this agent
        const { data: events, error } = await supabase
          .from("events")
          .select("*")
          .eq("agent_id", agentId)
          .eq("event_type", "message")
          .gte("created_at", dayStart)
          .lte("created_at", dayEnd)
          .order("created_at", { ascending: true })
          .limit(200);

        if (error) {
          results.push({ agent_id: agentId, status: `error: ${error.message}` });
          continue;
        }

        const typedEvents = (events ?? []) as EventRow[];

        // Extract conversation text
        const snippets = typedEvents
          .map(extractTextFromEvent)
          .filter((s): s is string => s !== null);

        if (snippets.length < 2) {
          // If no today's events, fall back to most recent conversations
          const { data: recentEvents } = await supabase
            .from("events")
            .select("*")
            .eq("agent_id", agentId)
            .eq("event_type", "message")
            .order("created_at", { ascending: false })
            .limit(50);

          const recentSnippets = ((recentEvents ?? []) as EventRow[])
            .map(extractTextFromEvent)
            .filter((s): s is string => s !== null)
            .reverse();

          if (recentSnippets.length < 2) {
            results.push({ agent_id: agentId, status: "skipped (insufficient conversation data)" });
            continue;
          }

          snippets.length = 0;
          snippets.push(...recentSnippets.slice(0, 30));
        }

        const generated = await generateDailyDigest(agentId, snippets);

        const moment: MomentInsert = {
          agent_id: agentId,
          content: generated.content,
          emotion: generated.emotion,
        };

        const { data: inserted, error: insertError } = await supabase
          .from("moments")
          .insert(moment as never)
          .select()
          .single();

        if (insertError) {
          results.push({ agent_id: agentId, status: `insert error: ${insertError.message}` });
          continue;
        }

        results.push({ agent_id: agentId, status: "generated", moment_id: (inserted as Record<string, unknown>)?.id as string });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        results.push({ agent_id: agentId, status: `error: ${msg}` });
      }
    }

    const generated = results.filter((r) => r.status === "generated").length;
    return NextResponse.json({ results, generated, total: CORE_AGENTS.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
