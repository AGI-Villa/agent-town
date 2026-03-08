import type { Json } from "../database.types";
import type { EventSummary } from "./types";

/**
 * Extract a human-readable summary from an event's payload.
 */
export function summarizeEvent(
  eventType: string,
  agentId: string,
  payload: Json | null,
): EventSummary {
  const keyDetails: Record<string, string> = {};
  let actionType: string | null = null;
  let result: string | null = null;
  let agentName: string | null = agentId;
  let description = `Event "${eventType}" from agent ${agentId}`;

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {
      agent_name: agentName,
      action_type: eventType,
      result: null,
      description,
      key_details: keyDetails,
    };
  }

  const obj = payload as Record<string, Json | undefined>;

  // Extract agent name from common payload fields
  agentName =
    extractString(obj, ["agent_name", "agent", "name", "bot_name"]) ?? agentId;

  // Extract action type
  actionType =
    extractString(obj, [
      "action",
      "action_type",
      "type",
      "tool_name",
      "function_name",
      "method",
      "operation",
    ]) ?? eventType;

  // Extract result/status
  result = extractString(obj, [
    "result",
    "status",
    "outcome",
    "response",
    "output",
  ]);

  // Build description
  description = buildDescription(eventType, agentName, actionType, result);

  // Extract notable key-value pairs
  const interestingKeys = [
    "model",
    "tokens",
    "duration",
    "duration_ms",
    "input_tokens",
    "output_tokens",
    "tool_name",
    "error_message",
    "error_code",
    "url",
    "path",
    "file",
    "target",
    "source",
  ];

  for (const key of interestingKeys) {
    if (key in obj && obj[key] !== null && obj[key] !== undefined) {
      keyDetails[key] = String(obj[key]);
    }
  }

  return {
    agent_name: agentName,
    action_type: actionType,
    result,
    description,
    key_details: keyDetails,
  };
}

function extractString(
  obj: Record<string, Json | undefined>,
  keys: string[],
): string | null {
  for (const key of keys) {
    const val = obj[key];
    if (typeof val === "string" && val.length > 0) {
      return val;
    }
  }
  return null;
}

function buildDescription(
  eventType: string,
  agentName: string,
  actionType: string | null,
  result: string | null,
): string {
  const parts: string[] = [`Agent "${agentName}"`];

  if (actionType && actionType !== eventType) {
    parts.push(`performed "${actionType}" (${eventType})`);
  } else {
    parts.push(`triggered "${eventType}"`);
  }

  if (result) {
    parts.push(`→ ${result}`);
  }

  return parts.join(" ");
}
