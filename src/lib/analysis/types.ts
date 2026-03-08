import type { Json } from "../database.types";

/** Classified event categories */
export type EventCategory =
  | "tool_call"
  | "error"
  | "completion"
  | "conversation"
  | "system"
  | "unknown";

/** Result of classifying a raw event */
export interface ClassificationResult {
  category: EventCategory;
  confidence: number; // 0-1
  subcategory: string | null;
}

/** Extracted summary from an event payload */
export interface EventSummary {
  agent_name: string | null;
  action_type: string | null;
  result: string | null;
  description: string;
  key_details: Record<string, string>;
}

/** Significance score for an event */
export interface SignificanceScore {
  score: number; // 0-100
  reasons: string[];
  should_generate_moment: boolean;
}

/** Complete analysis result for a single event */
export interface AnalysisResult {
  event_id: string;
  agent_id: string;
  original_event_type: string;
  classification: ClassificationResult;
  summary: EventSummary;
  significance: SignificanceScore;
  analyzed_at: string;
}

/** Shape of the analysis fields stored in the event payload */
export interface AnalysisPayload {
  analysis?: AnalysisResult;
  [key: string]: Json | AnalysisResult | undefined;
}

/** API query parameters for GET /api/analysis */
export interface AnalysisQueryParams {
  agent_id?: string;
  event_type?: EventCategory;
  min_score?: number;
  limit?: number;
  offset?: number;
}

/** API request body for POST /api/analysis */
export interface AnalyzeRequest {
  event_ids: string[];
}

/** API response for analyzed events */
export interface AnalysisResponse {
  results: AnalysisResult[];
  total: number;
}
