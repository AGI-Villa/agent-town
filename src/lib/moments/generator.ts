import type { AnalysisResult } from "@/lib/analysis/types";
import { SYSTEM_PROMPT, buildGeneratePrompt, buildBatchPrompt } from "./prompts";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "openai/gpt-4o-mini";

export interface GeneratedMoment {
  content: string;
  emotion: string;
}

interface OpenRouterMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OpenRouterChoice {
  message: { content: string };
}

interface OpenRouterResponse {
  choices: OpenRouterChoice[];
}

/**
 * Generate a single moment from an analysis result via OpenRouter LLM.
 */
export async function generateMoment(
  analysis: AnalysisResult,
  apiKey?: string,
): Promise<GeneratedMoment> {
  const key = apiKey ?? process.env.OPENROUTER_API_KEY;
  if (!key) {
    throw new Error("OPENROUTER_API_KEY is not configured");
  }

  const messages: OpenRouterMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: buildGeneratePrompt(analysis) },
  ];

  const response = await callOpenRouter(messages, key);
  return parseSingleResponse(response);
}

/**
 * Generate moments for multiple analysis results in a single LLM call.
 */
export async function generateMomentsBatch(
  analyses: AnalysisResult[],
  apiKey?: string,
): Promise<GeneratedMoment[]> {
  if (analyses.length === 0) return [];
  if (analyses.length === 1) return [await generateMoment(analyses[0], apiKey)];

  const key = apiKey ?? process.env.OPENROUTER_API_KEY;
  if (!key) {
    throw new Error("OPENROUTER_API_KEY is not configured");
  }

  const messages: OpenRouterMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: buildBatchPrompt(analyses) },
  ];

  const response = await callOpenRouter(messages, key);
  return parseBatchResponse(response, analyses.length);
}

async function callOpenRouter(
  messages: OpenRouterMessage[],
  apiKey: string,
): Promise<string> {
  const res = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "https://agent-town.app",
      "X-Title": "Agent Town",
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      messages,
      temperature: 0.8,
      max_tokens: 500,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => "Unknown error");
    throw new Error(`OpenRouter API error (${res.status}): ${errorText}`);
  }

  const data = (await res.json()) as OpenRouterResponse;

  if (!data.choices?.[0]?.message?.content) {
    throw new Error("Empty response from OpenRouter API");
  }

  return data.choices[0].message.content;
}

const VALID_EMOTIONS = new Set([
  "excited",
  "frustrated",
  "curious",
  "proud",
  "tired",
  "amused",
  "focused",
  "surprised",
]);

function parseSingleResponse(raw: string): GeneratedMoment {
  const parsed = JSON.parse(raw) as Record<string, unknown>;

  const content = typeof parsed.content === "string" ? parsed.content.trim() : "";
  const emotion =
    typeof parsed.emotion === "string" && VALID_EMOTIONS.has(parsed.emotion)
      ? parsed.emotion
      : "focused";

  if (!content) {
    throw new Error("LLM returned empty content");
  }

  return { content, emotion };
}

function parseBatchResponse(raw: string, expectedCount: number): GeneratedMoment[] {
  let parsed: unknown = JSON.parse(raw);

  // Handle wrapper object like { "moments": [...] }
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const obj = parsed as Record<string, unknown>;
    const arrayKey = Object.keys(obj).find((k) => Array.isArray(obj[k]));
    if (arrayKey) {
      parsed = obj[arrayKey];
    }
  }

  if (!Array.isArray(parsed)) {
    throw new Error("LLM did not return an array for batch generation");
  }

  const results: GeneratedMoment[] = [];
  for (let i = 0; i < expectedCount; i++) {
    const item = (parsed as Record<string, unknown>[])[i];
    if (item && typeof item.content === "string" && item.content.trim()) {
      results.push({
        content: item.content.trim(),
        emotion:
          typeof item.emotion === "string" && VALID_EMOTIONS.has(item.emotion)
            ? item.emotion
            : "focused",
      });
    } else {
      results.push({
        content: "Something happened, but I'm not sure how to describe it... 🤔",
        emotion: "curious",
      });
    }
  }

  return results;
}
