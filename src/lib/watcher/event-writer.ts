/**
 * Writes parsed JSONL events to the Supabase `events` table.
 */

import { getAdminClient } from "../supabase/admin";
import type { Database } from "../database.types";
import type { ParsedEvent } from "./jsonl-parser";

type EventInsert = Database["public"]["Tables"]["events"]["Insert"];

const BATCH_SIZE = 50;

/**
 * Insert a batch of events into Supabase in chunks of BATCH_SIZE.
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

  let totalWritten = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);

    try {
      const { error } = await client.from("events").insert(batch);

      if (error) {
        console.error(
          `[event-writer] Supabase insert error (batch ${Math.floor(i / BATCH_SIZE) + 1}):`,
          error.message
        );
        // Continue with remaining batches
        continue;
      }

      totalWritten += batch.length;
    } catch (err) {
      console.error(
        `[event-writer] Failed to write batch ${Math.floor(i / BATCH_SIZE) + 1}:`,
        err
      );
      // Continue with remaining batches
    }
  }

  return totalWritten;
}
