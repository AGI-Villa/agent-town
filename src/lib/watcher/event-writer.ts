/**
 * Writes parsed JSONL events to the Supabase `events` table.
 */

import { getAdminClient } from "../supabase/admin";
import type { Database } from "../database.types";
import type { ParsedEvent } from "./jsonl-parser";

type EventInsert = Database["public"]["Tables"]["events"]["Insert"];

/**
 * Insert a batch of events into Supabase.
 * Returns the count of successfully inserted events.
 */
export async function writeEvents(events: ParsedEvent[]): Promise<number> {
  if (events.length === 0) return 0;

  const client = getAdminClient();

  const rows: EventInsert[] = events.map((e) => ({
    agent_id: e.agent_id,
    event_type: e.event_type,
    payload: e.payload,
    ...(e.created_at ? { created_at: e.created_at } : {}),
  }));

  try {
    const { error } = await client.from("events").insert(rows);

    if (error) {
      console.error("[event-writer] Supabase insert error:", error.message);
      return 0;
    }

    return events.length;
  } catch (err) {
    console.error("[event-writer] Failed to write events:", err);
    return 0;
  }
}
