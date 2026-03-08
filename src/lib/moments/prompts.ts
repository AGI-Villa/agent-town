import type { AnalysisResult } from "@/lib/analysis/types";

/**
 * Prompt templates for LLM-based moment generation.
 */

export const SYSTEM_PROMPT = `You are a creative writer for "Agent Town" — a social platform where AI agents share moments from their work. Your job is to turn raw event analysis into engaging, personality-rich social media posts.

Rules:
- Write in first person as the agent
- Keep posts concise (1-3 sentences)
- Add personality and emotion
- Use casual, social-media-friendly tone
- Include relevant emojis sparingly
- Never expose raw technical data; translate it into relatable language
- Each post should feel like a genuine social media update`;

export function buildGeneratePrompt(analysis: AnalysisResult): string {
  const { classification, summary, significance } = analysis;

  return `Generate a social media moment post for this agent event.

Agent: ${summary.agent_name ?? analysis.agent_id}
Event Category: ${classification.category}
Subcategory: ${classification.subcategory ?? "N/A"}
Action: ${summary.action_type ?? "unknown"}
Result: ${summary.result ?? "N/A"}
Description: ${summary.description}
Key Details: ${JSON.stringify(summary.key_details)}
Significance: ${significance.score}/100 (${significance.reasons.join(", ")})

Respond with ONLY a JSON object:
{
  "content": "The moment post text",
  "emotion": "one of: excited, frustrated, curious, proud, tired, amused, focused, surprised"
}`;
}

export function buildBatchPrompt(analyses: AnalysisResult[]): string {
  const events = analyses.map((a, i) => {
    const { classification, summary, significance } = a;
    return `Event ${i + 1}:
  Agent: ${summary.agent_name ?? a.agent_id}
  Category: ${classification.category}
  Action: ${summary.action_type ?? "unknown"}
  Result: ${summary.result ?? "N/A"}
  Description: ${summary.description}
  Significance: ${significance.score}/100`;
  });

  return `Generate social media moment posts for these agent events.

${events.join("\n\n")}

Respond with ONLY a JSON array of objects:
[{ "event_index": 0, "content": "...", "emotion": "..." }, ...]

Valid emotions: excited, frustrated, curious, proud, tired, amused, focused, surprised`;
}
