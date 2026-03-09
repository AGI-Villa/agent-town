import type { Json } from "../database.types";
import type { ClassificationResult, SignificanceScore } from "./types";

/** Threshold above which an event should generate a moment */
const MOMENT_THRESHOLD = 40;

/** Base scores by event category */
const CATEGORY_BASE_SCORES: Record<string, number> = {
  error: 70,
  completion: 50,
  tool_call: 40,
  conversation: 55,
  system: 20,
  unknown: 15,
};

/**
 * Score the significance of an event (0-100).
 * Higher scores indicate events more worthy of generating a "moment" post.
 */
export function scoreSignificance(
  eventType: string,
  payload: Json | null,
  classification: ClassificationResult,
): SignificanceScore {
  const reasons: string[] = [];
  let score = CATEGORY_BASE_SCORES[classification.category] ?? 15;

  // Boost for high-confidence classification
  if (classification.confidence >= 0.9) {
    score += 5;
    reasons.push("High-confidence classification");
  }

  // Analyze payload richness
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const obj = payload as Record<string, Json | undefined>;
    const fieldCount = Object.keys(obj).length;

    // Rich payloads are more interesting
    if (fieldCount >= 10) {
      score += 10;
      reasons.push("Rich payload with many fields");
    } else if (fieldCount >= 5) {
      score += 5;
      reasons.push("Moderate payload detail");
    }

    // Error events with messages are more significant
    if (classification.category === "error") {
      if (obj["error_message"] || obj["error"] || obj["stack"]) {
        score += 10;
        reasons.push("Error with detailed message");
      }
      if (obj["fatal"] === true || obj["critical"] === true) {
        score += 15;
        reasons.push("Critical/fatal error");
      }
    }

    // Completion events with token usage are interesting
    if (classification.category === "completion") {
      if (obj["tokens"] || obj["output_tokens"]) {
        score += 5;
        reasons.push("LLM completion with token metrics");
      }
      if (obj["model"]) {
        score += 5;
        reasons.push("Model information available");
      }
    }

    // Tool calls with results
    if (classification.category === "tool_call") {
      if (obj["result"] || obj["output"]) {
        score += 10;
        reasons.push("Tool call with result");
      }
    }

    // Conversation events with content
    if (classification.category === "conversation") {
      const content = obj["content"] || obj["message"] || obj["text"];
      if (typeof content === "string" && content.length > 100) {
        score += 10;
        reasons.push("Substantial conversation content");
      }
    }
  }

  // Event type name heuristics
  const lowerType = eventType.toLowerCase();
  if (lowerType.includes("important") || lowerType.includes("critical")) {
    score += 15;
    reasons.push("Event type indicates importance");
  }
  if (lowerType.includes("milestone") || lowerType.includes("achievement")) {
    score += 20;
    reasons.push("Milestone or achievement event");
  }

  // Clamp to 0-100
  score = Math.max(0, Math.min(100, score));

  if (reasons.length === 0) {
    reasons.push(`Base score for category "${classification.category}"`);
  }

  return {
    score,
    reasons,
    should_generate_moment: score >= MOMENT_THRESHOLD,
  };
}
