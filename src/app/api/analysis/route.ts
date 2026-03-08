import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { analyzeEvent } from "@/lib/analysis";
import type { AnalysisResult } from "@/lib/analysis/types";
import type { Database, Json } from "@/lib/database.types";

type EventRow = Database["public"]["Tables"]["events"]["Row"];

const VALID_CATEGORIES = [
  "tool_call",
  "error",
  "completion",
  "conversation",
  "system",
  "unknown",
];

/**
 * GET /api/analysis
 * Query analyzed events with optional filters.
 *
 * Query params:
 *   agent_id   - filter by agent
 *   event_type - filter by classified category
 *   min_score  - minimum significance score (0-100)
 *   limit      - max results (default 20, max 100)
 *   offset     - pagination offset (default 0)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get("agent_id");
    const eventType = searchParams.get("event_type");
    const minScore = parseInt(searchParams.get("min_score") || "0", 10);
    const limit = Math.min(
      Math.max(parseInt(searchParams.get("limit") || "20", 10), 1),
      100,
    );
    const offset = Math.max(
      parseInt(searchParams.get("offset") || "0", 10),
      0,
    );

    const supabase = await createClient();

    let query = supabase
      .from("events")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });

    if (agentId) {
      query = query.eq("agent_id", agentId);
    }

    // If event_type is not a classified category, filter at DB level
    if (eventType && !VALID_CATEGORIES.includes(eventType)) {
      query = query.eq("event_type", eventType);
    }

    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      return NextResponse.json(
        { error: `Database query failed: ${error.message}` },
        { status: 500 },
      );
    }

    const events = (data ?? []) as EventRow[];

    // Analyze each event
    let results: AnalysisResult[] = events.map((event) => analyzeEvent(event));

    // Post-analysis category filter
    if (eventType && VALID_CATEGORIES.includes(eventType)) {
      results = results.filter(
        (r) => r.classification.category === eventType,
      );
    }

    if (minScore > 0) {
      results = results.filter((r) => r.significance.score >= minScore);
    }

    return NextResponse.json({
      results,
      total: count ?? results.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/analysis
 * Trigger analysis for specific events and persist results in the payload.
 *
 * Body: { event_ids: string[] }
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { event_ids?: string[] };
    const { event_ids } = body;

    if (!event_ids || !Array.isArray(event_ids) || event_ids.length === 0) {
      return NextResponse.json(
        { error: "event_ids must be a non-empty array of strings" },
        { status: 400 },
      );
    }

    if (event_ids.length > 50) {
      return NextResponse.json(
        { error: "Maximum 50 events per request" },
        { status: 400 },
      );
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from("events")
      .select("*")
      .in("id", event_ids);

    if (error) {
      return NextResponse.json(
        { error: `Failed to fetch events: ${error.message}` },
        { status: 500 },
      );
    }

    const events = (data ?? []) as EventRow[];

    if (events.length === 0) {
      return NextResponse.json(
        { error: "No events found for the given IDs" },
        { status: 404 },
      );
    }

    const results: AnalysisResult[] = [];
    const errors: string[] = [];

    for (const event of events) {
      try {
        const analysis = analyzeEvent(event);
        results.push(analysis);

        // Persist analysis in the event's payload
        const existingPayload =
          event.payload && typeof event.payload === "object"
            ? (event.payload as Record<string, Json | undefined>)
            : {};

        const updatedPayload: Record<string, Json | undefined> = {
          ...existingPayload,
          _analysis: {
            category: analysis.classification.category,
            confidence: analysis.classification.confidence,
            significance_score: analysis.significance.score,
            should_generate_moment:
              analysis.significance.should_generate_moment,
            summary: analysis.summary.description,
            analyzed_at: analysis.analyzed_at,
          } as unknown as Json,
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: updateError } = await (supabase as any)
          .from("events")
          .update({ payload: updatedPayload })
          .eq("id", event.id);

        if (updateError) {
          errors.push(
            `Failed to update event ${event.id}: ${updateError.message}`,
          );
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        errors.push(`Failed to analyze event ${event.id}: ${msg}`);
      }
    }

    return NextResponse.json({
      results,
      total: results.length,
      ...(errors.length > 0 ? { errors } : {}),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
