import type { Database, Json } from "../database.types";
import type { AnalysisResult } from "./types";
import { classifyEvent } from "./event-classifier";
import { summarizeEvent } from "./event-summarizer";
import { scoreSignificance } from "./significance-scorer";

type EventRow = Database["public"]["Tables"]["events"]["Row"];

/**
 * Run the full analysis pipeline on a single event row.
 * Returns an AnalysisResult with classification, summary, and significance score.
 */
export function analyzeEvent(event: EventRow): AnalysisResult {
  const payload = event.payload as Json | null;

  const classification = classifyEvent(event.event_type, payload);
  const summary = summarizeEvent(event.event_type, event.agent_id, payload);
  const significance = scoreSignificance(
    event.event_type,
    payload,
    classification,
  );

  return {
    event_id: event.id,
    agent_id: event.agent_id,
    original_event_type: event.event_type,
    classification,
    summary,
    significance,
    analyzed_at: new Date().toISOString(),
  };
}

export { classifyEvent } from "./event-classifier";
export { summarizeEvent } from "./event-summarizer";
export { scoreSignificance } from "./significance-scorer";
export type * from "./types";
