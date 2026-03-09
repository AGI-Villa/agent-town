import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateDailyDigest } from "@/lib/moments/generator";
import { generateAgentComments } from "@/lib/moments/comments";
import type { Database } from "@/lib/database.types";

type EventRow = Database["public"]["Tables"]["events"]["Row"];
type MomentRow = Database["public"]["Tables"]["moments"]["Row"];
type MomentInsert = Database["public"]["Tables"]["moments"]["Insert"];

import { getActiveAgentIds, ensureAgentsLoaded } from "@/lib/agents";

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
 * After generation, other agents randomly comment on the new moment.
 *
 * Body (optional):
 *   { date?: string }  — ISO date string like "2026-03-09", defaults to today
 */
export async function POST(request: Request) {
  const { requireAuth } = await import("@/lib/api-auth");
  const authError = requireAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json().catch(() => ({})) as { date?: string };
    const targetDate = body.date ?? new Date().toISOString().split("T")[0];
    const dayStart = `${targetDate}T00:00:00Z`;
    const dayEnd = `${targetDate}T23:59:59Z`;

    await ensureAgentsLoaded();
    const activeAgents = getActiveAgentIds();

    const supabase = await createClient();
    const results: Array<{
      agent_id: string;
      status: string;
      moment_id?: string;
      comments?: { commenterId: string; status: string }[];
    }> = [];

    for (const agentId of activeAgents) {
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

        // Part 3: Fetch recent 3 moments for continuous memory
        const { data: recentMomentsData } = await supabase
          .from("moments")
          .select("content")
          .eq("agent_id", agentId)
          .order("created_at", { ascending: false })
          .limit(3);

        const recentMoments = ((recentMomentsData ?? []) as MomentRow[])
          .map((m) => m.content)
          .reverse();

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

        // Generate moment with continuous memory context
        const generated = await generateDailyDigest(
          agentId,
          snippets,
          undefined,
          recentMoments.length > 0 ? recentMoments : undefined
        );

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

        const momentId = (inserted as Record<string, unknown>)?.id as string;
        const momentContent = generated.content;

        // Part 2: Generate agent cross-comments
        const commentResults = await generateAgentComments(momentId, agentId, momentContent);

        results.push({
          agent_id: agentId,
          status: "generated",
          moment_id: momentId,
          comments: commentResults,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        results.push({ agent_id: agentId, status: `error: ${msg}` });
      }
    }

    const generated = results.filter((r) => r.status === "generated").length;
    return NextResponse.json({ results, generated, total: activeAgents.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
