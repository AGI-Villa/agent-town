import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { analyzeEvent } from "@/lib/analysis";
import { generateMomentsBatch } from "@/lib/moments/generator";
import type { Database } from "@/lib/database.types";

type EventRow = Database["public"]["Tables"]["events"]["Row"];
type MomentInsert = Database["public"]["Tables"]["moments"]["Insert"];

/**
 * POST /api/moments/generate
 * Analyze events and generate moment posts via LLM.
 *
 * Body:
 *   { event_ids: string[] }           — generate moments for specific events
 *   { agent_id: string, limit?: number } — auto-pick significant events for an agent
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      event_ids?: string[];
      agent_id?: string;
      limit?: number;
    };

    const supabase = await createClient();
    let events: EventRow[];

    if (body.event_ids && Array.isArray(body.event_ids) && body.event_ids.length > 0) {
      if (body.event_ids.length > 20) {
        return NextResponse.json(
          { error: "Maximum 20 events per request" },
          { status: 400 },
        );
      }

      const { data, error } = await supabase
        .from("events")
        .select("*")
        .in("id", body.event_ids);

      if (error) {
        return NextResponse.json(
          { error: `Failed to fetch events: ${error.message}` },
          { status: 500 },
        );
      }

      events = (data ?? []) as EventRow[];
    } else if (body.agent_id) {
      const limit = Math.min(Math.max(body.limit ?? 5, 1), 20);

      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("agent_id", body.agent_id)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) {
        return NextResponse.json(
          { error: `Failed to fetch events: ${error.message}` },
          { status: 500 },
        );
      }

      events = (data ?? []) as EventRow[];
    } else {
      return NextResponse.json(
        { error: "Provide event_ids or agent_id" },
        { status: 400 },
      );
    }

    if (events.length === 0) {
      return NextResponse.json(
        { error: "No events found" },
        { status: 404 },
      );
    }

    // Analyze events and filter by significance
    const analyses = events
      .map((event) => analyzeEvent(event))
      .filter((a) => a.significance.should_generate_moment);

    if (analyses.length === 0) {
      return NextResponse.json({
        moments: [],
        message: "No events met the significance threshold for moment generation",
      });
    }

    // Generate moments via LLM
    const generated = await generateMomentsBatch(analyses);

    // Persist generated moments
    const moments: MomentInsert[] = generated.map((g, i) => ({
      agent_id: analyses[i].agent_id,
      content: g.content,
      emotion: g.emotion,
      trigger_event_id: analyses[i].event_id,
    }));

    const { data: inserted, error: insertError } = await supabase
      .from("moments")
      .insert(moments as never[])
      .select();

    if (insertError) {
      return NextResponse.json(
        { error: `Failed to save moments: ${insertError.message}` },
        { status: 500 },
      );
    }

    return NextResponse.json({
      moments: inserted,
      total: inserted?.length ?? 0,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
