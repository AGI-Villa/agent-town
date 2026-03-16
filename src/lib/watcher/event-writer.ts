/**
 * Writes parsed JSONL events to the Supabase `events` table.
 * Also creates notifications for significant events.
 * Also extracts and writes token usage data.
 * Integrates with the plugin system for custom event type handling.
 */

import { getAdminClient } from "../supabase/admin";
import type { Database } from "../database.types";
import type { ParsedEvent } from "./jsonl-parser";
import { pluginRegistry, initializePlugins } from "../plugins";

// Ensure plugins are initialized
let pluginsInitialized = false;
function ensurePluginsInitialized() {
  if (!pluginsInitialized) {
    initializePlugins();
    pluginsInitialized = true;
  }
}

type EventInsert = Database["public"]["Tables"]["events"]["Insert"];
type NotificationInsert = Database["public"]["Tables"]["notifications"]["Insert"];
type TokenUsageInsert = Database["public"]["Tables"]["token_usage"]["Insert"];

// Model pricing per 1M tokens (input/output)
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "gpt-4": { input: 30, output: 60 },
  "gpt-4-turbo": { input: 10, output: 30 },
  "gpt-4o": { input: 2.5, output: 10 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gpt-3.5-turbo": { input: 0.5, output: 1.5 },
  "claude-3-opus": { input: 15, output: 75 },
  "claude-3-sonnet": { input: 3, output: 15 },
  "claude-3-haiku": { input: 0.25, output: 1.25 },
  "claude-3.5-sonnet": { input: 3, output: 15 },
  "claude-opus-4": { input: 15, output: 75 },
  "claude-sonnet-4": { input: 3, output: 15 },
  "deepseek-chat": { input: 0.14, output: 0.28 },
  "deepseek-coder": { input: 0.14, output: 0.28 },
};

/**
 * Calculate estimated cost based on model and token counts.
 */
function calculateCost(
  model: string | undefined,
  promptTokens: number,
  completionTokens: number
): number {
  if (!model) return 0;
  
  // Find matching pricing (partial match)
  const modelKey = Object.keys(MODEL_PRICING).find(
    (key) => model.toLowerCase().includes(key.toLowerCase())
  );
  
  if (!modelKey) return 0;
  
  const pricing = MODEL_PRICING[modelKey];
  const inputCost = (promptTokens / 1_000_000) * pricing.input;
  const outputCost = (completionTokens / 1_000_000) * pricing.output;
  
  return inputCost + outputCost;
}

interface TokenUsageData {
  agent_id: string;
  session_id?: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  model?: string;
  created_at?: string;
}

/**
 * Extract token usage from event payload.
 */
function extractTokenUsage(event: ParsedEvent): TokenUsageData | null {
  if (!event.payload || typeof event.payload !== "object") return null;
  
  const payload = event.payload as Record<string, unknown>;
  
  // Check for usage in response
  const response = payload.response as Record<string, unknown> | undefined;
  const usage = (response?.usage ?? payload.usage) as Record<string, unknown> | undefined;
  
  if (!usage) return null;
  
  const promptTokens = (usage.prompt_tokens ?? usage.input_tokens ?? 0) as number;
  const completionTokens = (usage.completion_tokens ?? usage.output_tokens ?? 0) as number;
  const totalTokens = (usage.total_tokens ?? promptTokens + completionTokens) as number;
  
  if (totalTokens === 0) return null;
  
  // Extract model from various locations
  const model = (response?.model ?? payload.model ?? usage.model) as string | undefined;
  
  // Extract session_id if available
  const sessionId = payload.session_id as string | undefined;
  
  return {
    agent_id: event.agent_id,
    session_id: sessionId,
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    total_tokens: totalTokens,
    model,
    created_at: event.created_at,
  };
}

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
 * Now integrates with the plugin system for custom notification rules.
 */
function shouldNotify(event: ParsedEvent): boolean {
  ensurePluginsInitialized();
  
  const eventType = event.event_type.toLowerCase();
  
  // First, try plugin-based notification check
  const pluginResult = pluginRegistry.parseEvent(
    event.event_type,
    event.payload,
    { agentId: event.agent_id }
  );
  
  if (pluginResult?.shouldNotify) {
    return true;
  }
  
  // Check plugin notification rules
  if (pluginResult?.eventTypeId) {
    const rules = pluginRegistry.getNotificationRules(pluginResult.eventTypeId);
    for (const rule of rules) {
      if (rule.condition) {
        if (rule.condition(pluginResult, event.payload)) {
          return true;
        }
      } else {
        // No condition means always notify for this event type
        return true;
      }
    }
  }
  
  // Fallback to built-in notification types
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
 * Now integrates with the plugin system for custom notification messages.
 */
function generateNotificationContent(event: ParsedEvent): string {
  ensurePluginsInitialized();
  
  const agentName = event.agent_id;
  const eventType = event.event_type;
  
  // First, try plugin-based notification content
  const pluginResult = pluginRegistry.parseEvent(
    event.event_type,
    event.payload,
    { agentId: event.agent_id }
  );
  
  if (pluginResult?.notificationMessage) {
    return `${agentName} ${pluginResult.notificationMessage}`;
  }
  
  if (pluginResult?.summary) {
    return `${agentName} ${pluginResult.summary}`;
  }
  
  // Fallback to built-in content generation
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
  const tokenUsageToWrite: TokenUsageData[] = [];

  // Extract token usage from all events
  for (const event of events) {
    const usage = extractTokenUsage(event);
    if (usage) {
      tokenUsageToWrite.push(usage);
    }
  }

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

  // Write token usage data
  if (tokenUsageToWrite.length > 0) {
    await writeTokenUsage(tokenUsageToWrite);
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

/**
 * Write token usage data to the database.
 */
async function writeTokenUsage(usageData: TokenUsageData[]): Promise<void> {
  const client = getAdminClient();

  const rows: TokenUsageInsert[] = usageData.map((data) => ({
    agent_id: data.agent_id,
    session_id: data.session_id ?? null,
    prompt_tokens: data.prompt_tokens,
    completion_tokens: data.completion_tokens,
    total_tokens: data.total_tokens,
    model: data.model ?? null,
    estimated_cost: calculateCost(data.model, data.prompt_tokens, data.completion_tokens),
    ...(data.created_at ? { created_at: data.created_at } : {}),
  }));

  try {
    const { error } = await client.from("token_usage").insert(rows);
    if (error) {
      console.error("[event-writer] Failed to write token usage:", error.message);
    } else {
      console.log(`[event-writer] Wrote ${rows.length} token usage records`);
    }
  } catch (err) {
    console.error("[event-writer] Error writing token usage:", err);
  }
}
