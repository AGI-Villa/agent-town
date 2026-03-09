/**
 * Agent cross-commenting system for moments.
 * After a moment is generated, other agents randomly comment on it.
 */

import { getAdminClient } from "@/lib/supabase/admin";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "stepfun/step-3.5-flash:free";

export const AGENT_NAMES: Record<string, string> = {
  secretary: "刘亦菲",
  cto: "扫地僧",
  "dev-lead": "韦小宝",
  cpo: "乔布斯",
  uiux: "高圆圆",
  cmo: "达达里奥",
  culture: "李子柒",
  hardware: "马斯克",
  advisor: "巴菲特",
};

export const AGENT_PERSONALITIES: Record<string, string> = {
  secretary: "温柔细心、善于协调、偶尔吐槽",
  cto: "技术宅、熬夜冠军、低调实干",
  "dev-lead": "活泼机灵、爱开玩笑、执行力强",
  cpo: "追求完美、善于思考、有点强迫症",
  uiux: "审美极佳、感性、注重细节",
  cmo: "外向热情、脑洞大、行动派",
  culture: "安静内敛、热爱传统文化、手艺人",
  hardware: "大胆激进、技术理想主义、偶尔发呆",
  advisor: "稳重睿智、长期主义、爱用比喻",
};

interface OpenRouterMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OpenRouterChoice {
  message: { content: string | null; reasoning?: string };
}

interface OpenRouterResponse {
  choices: OpenRouterChoice[];
}

/**
 * Generate a comment from one agent to another's moment.
 */
async function generateComment(
  commenterId: string,
  momentAuthorId: string,
  momentContent: string,
  apiKey: string
): Promise<string> {
  const commenterName = AGENT_NAMES[commenterId] || commenterId;
  const commenterPersonality = AGENT_PERSONALITIES[commenterId] || "友善热情";
  const authorName = AGENT_NAMES[momentAuthorId] || momentAuthorId;

  const systemPrompt = `你是 Agent Town 小镇的居民 ${commenterName}。
你的性格：${commenterPersonality}

你正在给同事 ${authorName} 的朋友圈点评。写一条简短的评论（1-2句话）。

要求：
- 用中文，口语化
- 符合你的性格特点
- 可以调侃、鼓励、共鸣、或者开玩笑
- 不要太正式，像朋友之间的互动
- 可以用 1 个 emoji，但不要过度
- 直接输出评论内容，不要任何格式包装`;

  const userPrompt = `${authorName} 发了这条朋友圈：

"${momentContent}"

请写一条评论：`;

  const messages: OpenRouterMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

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
      temperature: 0.9,
      max_tokens: 200,
    }),
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => "Unknown error");
    throw new Error(`OpenRouter API error (${res.status}): ${errorText}`);
  }

  const data = (await res.json()) as OpenRouterResponse;
  const content = data.choices?.[0]?.message?.content?.trim();

  if (!content) {
    throw new Error("Empty response from OpenRouter API");
  }

  return content;
}

/**
 * Select random agents to comment on a moment (excluding the author).
 */
function selectCommenters(authorId: string, count: number = 2): string[] {
  const allAgents = Object.keys(AGENT_NAMES).filter((id) => id !== authorId);
  const shuffled = allAgents.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

/**
 * Generate comments from other agents for a newly created moment.
 */
export async function generateAgentComments(
  momentId: string,
  momentAuthorId: string,
  momentContent: string
): Promise<{ commenterId: string; status: string }[]> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.warn("[comments] OPENROUTER_API_KEY not configured, skipping comments");
    return [];
  }

  const supabase = getAdminClient();
  const results: { commenterId: string; status: string }[] = [];

  // Randomly select 2-3 agents to comment
  const commentCount = Math.floor(Math.random() * 2) + 2; // 2 or 3
  const commenters = selectCommenters(momentAuthorId, commentCount);

  for (const commenterId of commenters) {
    try {
      const comment = await generateComment(
        commenterId,
        momentAuthorId,
        momentContent,
        apiKey
      );

      const { error } = await supabase.from("comments").insert({
        moment_id: momentId,
        author_type: "agent",
        author_id: commenterId,
        content: comment,
      });

      if (error) {
        results.push({ commenterId, status: `insert error: ${error.message}` });
      } else {
        results.push({ commenterId, status: "success" });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({ commenterId, status: `error: ${msg}` });
    }
  }

  return results;
}
