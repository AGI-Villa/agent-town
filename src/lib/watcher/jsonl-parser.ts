/**
 * JSONL parser — reads a file and returns parsed JSON objects per line.
 * Tracks file offsets so we only process new lines on subsequent reads.
 */

import { readFile } from "fs/promises";

import type { Json } from "../database.types";

export interface ParsedEvent {
  agent_id: string;
  event_type: string;
  payload: Json | null;
  created_at?: string;
}

/**
 * Parse JSONL content string into an array of ParsedEvent objects.
 * Skips blank lines and logs malformed lines without throwing.
 */
export function parseJsonlContent(content: string): ParsedEvent[] {
  const events: ParsedEvent[] = [];
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    try {
      const obj = JSON.parse(line);

      const event: ParsedEvent = {
        agent_id: obj.agent_id ?? obj.agentId ?? "unknown",
        event_type: obj.event_type ?? obj.eventType ?? obj.type ?? "unknown",
        payload: obj,
        created_at: obj.created_at ?? obj.timestamp ?? undefined,
      };

      events.push(event);
    } catch {
      console.warn(`[jsonl-parser] Skipping malformed line ${i + 1}: ${line.slice(0, 100)}`);
    }
  }

  return events;
}

/**
 * Read a JSONL file from a given byte offset and return new events + new offset.
 */
export async function readJsonlFile(
  filePath: string,
  fromOffset: number = 0
): Promise<{ events: ParsedEvent[]; newOffset: number }> {
  try {
    const buffer = await readFile(filePath);
    const totalSize = buffer.length;

    if (fromOffset >= totalSize) {
      return { events: [], newOffset: fromOffset };
    }

    const newContent = buffer.subarray(fromOffset).toString("utf-8");
    const events = parseJsonlContent(newContent);

    return { events, newOffset: totalSize };
  } catch (err) {
    console.error(`[jsonl-parser] Failed to read file ${filePath}:`, err);
    return { events: [], newOffset: fromOffset };
  }
}
