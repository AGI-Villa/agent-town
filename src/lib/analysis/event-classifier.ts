import type { Json } from "../database.types";
import type { ClassificationResult, EventCategory } from "./types";

/** Keyword patterns mapped to event categories */
const CATEGORY_PATTERNS: Record<EventCategory, RegExp[]> = {
  tool_call: [
    /tool[_\s-]?(call|use|invoke|execution)/i,
    /function[_\s-]?call/i,
    /api[_\s-]?(call|request|invoke)/i,
    /execute/i,
    /run[_\s-]?tool/i,
  ],
  error: [
    /error/i,
    /fail(ure|ed)?/i,
    /exception/i,
    /crash/i,
    /timeout/i,
    /panic/i,
    /fatal/i,
  ],
  completion: [
    /complet(e|ion|ed)/i,
    /finish(ed)?/i,
    /done/i,
    /success/i,
    /result/i,
    /response[_\s-]?generat/i,
    /llm[_\s-]?(response|output)/i,
  ],
  conversation: [
    /message/i,
    /chat/i,
    /conversation/i,
    /user[_\s-]?(input|message|query)/i,
    /reply/i,
    /prompt/i,
  ],
  system: [
    /system/i,
    /startup/i,
    /shutdown/i,
    /health[_\s-]?check/i,
    /heartbeat/i,
    /config/i,
    /init/i,
    /boot/i,
    /status[_\s-]?change/i,
  ],
  unknown: [],
};

/** High-confidence event_type direct mappings */
const DIRECT_MAPPINGS: Record<string, EventCategory> = {
  tool_call: "tool_call",
  tool_result: "tool_call",
  function_call: "tool_call",
  api_call: "tool_call",
  error: "error",
  failure: "error",
  exception: "error",
  completion: "completion",
  llm_response: "completion",
  task_complete: "completion",
  message: "conversation",
  user_message: "conversation",
  chat: "conversation",
  system: "system",
  heartbeat: "system",
  startup: "system",
  shutdown: "system",
  health_check: "system",
  session: "system",
  thinking: "completion",
  thinking_level_change: "system",
  model_change: "system",
  custom: "tool_call",
};

/**
 * Classify a raw event into a category based on event_type and payload.
 */
export function classifyEvent(
  eventType: string,
  payload: Json | null,
): ClassificationResult {
  // 1. Try direct mapping (highest confidence)
  const normalized = eventType.toLowerCase().trim();
  if (normalized in DIRECT_MAPPINGS) {
    return {
      category: DIRECT_MAPPINGS[normalized],
      confidence: 0.95,
      subcategory: normalized,
    };
  }

  // 2. Try pattern matching on event_type
  for (const [category, patterns] of Object.entries(CATEGORY_PATTERNS)) {
    if (category === "unknown") continue;
    for (const pattern of patterns) {
      if (pattern.test(eventType)) {
        return {
          category: category as EventCategory,
          confidence: 0.8,
          subcategory: extractSubcategory(eventType),
        };
      }
    }
  }

  // 3. Try payload-based classification
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const payloadStr = JSON.stringify(payload).toLowerCase();
    for (const [category, patterns] of Object.entries(CATEGORY_PATTERNS)) {
      if (category === "unknown") continue;
      for (const pattern of patterns) {
        if (pattern.test(payloadStr)) {
          return {
            category: category as EventCategory,
            confidence: 0.5,
            subcategory: extractSubcategory(eventType),
          };
        }
      }
    }
  }

  return {
    category: "unknown",
    confidence: 0.1,
    subcategory: null,
  };
}

function extractSubcategory(eventType: string): string {
  return eventType
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}
