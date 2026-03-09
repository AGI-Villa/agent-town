/**
 * Writes parsed JSONL events to the Supabase `events` table.
 * Also creates notifications for significant events.
 */

import { getAdminClient } from "../supabase/admin";
import type { Database } from "../database.types";
import type { ParsedEvent } from "./jsonl-parser";

type EventInsert = Database["public"]["Tables"]["events"]["Insert"];
type NotificationInsert = Database["public"]["Tables"]["notifications"]["Insert"];

const BATCH_SIZE = 50;

// Event types that always trigger notifications
const NOTIFICATION_EVENT_TYPES = new Set([
  "pr_merged",
  "pr_merge",
  "merge",
  "error",
  "task_complete",
  "task_completed",
  "deploy",
  "deployment",
  "release",
  "build_success",
  "build_failure",
]);

// Keywords in event_type that suggest high significance
const HIGH_SIGNIFICANCE_KEYWORDS = [
  "complete",
  "finish",
  "success",
  "fail",
  "error",
  "merge",
  "deploy",
  "release",
];

/**
 * Check if an event should trigger a notification.
 */
function shouldNotify(event: ParsedEvent): boolean {
  const eventType = event.event_type.toLowerCase();
  
  // Check explicit notification types
  if (NOTIFICATION_EVENT_TYPES.has(eventType)) {
    return true;
  }
  
  // Check for high significance keywords
  if (HIGH_SIGNIFICANCE_KEYWORDS.some(kw => eventType.includes(kw))) {
    return true;
  }
  
  // Check payload for significance score
  if (event.payload && typeof event.payload === "object") {
    const payload = event.payload as Record<string, unknown>;
    const score = payload.significance_score ?? payload.significanceScore ?? payload.score;
    if (typeof score === "number" && score >= 70) {
      return true;
    }
  }
  
  return false;
}

/**
 * Generate notification content from an event.
 */
function generateNotificationContent(event: ParsedEvent): string {
  const agentName = event.agent_id;
  const eventType = event.event_type;
  
  // Try to extract summary from payload
  let summary = "";
  if (event.payload && typeof event.payload === "object") {
    const payload = event.payload as Record<string, unknown>;
    summary = (payload.summary ?? payload.message ?? payload.description ?? "") as string;
  }
  
  // Format based on event type
  const typeMap: Record<string, string> = {
    pr_merged: "合并了 PR",
    pr_merge: "合并了 PR",
    merge: "完成了合并",
    error: "遇到了错误",
    task_complete: "完成了任务",
    task_completed: "完成了任务",
    deploy: "完成了部署",
    deployment: "完成了部署",
    release: "发布了新版本",
    build_success: "构建成功",
    build_failure: "构建失败",
  };
  
  const action = typeMap[eventType.toLowerCase()] ?? `完成了 ${eventType}`;
  
  if (summary) {
    return `${agentName} ${action}：${summary}`;
  }
  return `${agentName} ${action}`;
}

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
  const notificationsToCreate: { event: ParsedEvent; eventId?: string }[] = [];

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const batchEvents = events.slice(i, i + BATCH_SIZE);

    try {
      const { data, error } = await client.from("events").insert(batch).select("id");

      if (error) {
        console.error(
          `[event-writer] Supabase insert error (batch ${Math.floor(i / BATCH_SIZE) + 1}):`,
          error.message
        );
        continue;
      }

      totalWritten += batch.length;

      // Check which events should trigger notifications
      batchEvents.forEach((event, idx) => {
        if (shouldNotify(event)) {
          notificationsToCreate.push({
            event,
            eventId: data?.[idx]?.id,
          });
        }
      });
    } catch (err) {
      console.error(
        `[event-writer] Failed to write batch ${Math.floor(i / BATCH_SIZE) + 1}:`,
        err
      );
    }
  }

  // Create notifications for significant events
  if (notificationsToCreate.length > 0) {
    await createNotifications(notificationsToCreate);
  }

  return totalWritten;
}

/**
 * Create notifications for significant events.
 */
async function createNotifications(
  items: { event: ParsedEvent; eventId?: string }[]
): Promise<void> {
  const client = getAdminClient();

  const notifications: NotificationInsert[] = items.map(({ event, eventId }) => ({
    agent_id: event.agent_id,
    content: generateNotificationContent(event),
    event_id: eventId ?? null,
    read: false,
  }));

  try {
    const { error } = await client.from("notifications").insert(notifications);
    if (error) {
      console.error("[event-writer] Failed to create notifications:", error.message);
    } else {
      console.log(`[event-writer] Created ${notifications.length} notifications`);
    }
  } catch (err) {
    console.error("[event-writer] Error creating notifications:", err);
  }
}
