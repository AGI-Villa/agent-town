/**
 * Built-in OpenClaw Plugin
 * 
 * Default plugin for parsing OpenClaw agent events.
 */

import type { Json } from "../../database.types";
import type { EventPlugin, ParsedPluginEvent, EventParserMetadata } from "../types";

/**
 * OpenClaw event type patterns
 */
const OPENCLAW_PATTERNS = {
  tool_call: /^(tool_call|function_call|api_call|execute)$/i,
  tool_result: /^(tool_result|function_result|api_result)$/i,
  message: /^(message|user_message|assistant_message|chat)$/i,
  thinking: /^(thinking|reasoning|thought)$/i,
  spawn: /^(sessions_spawn|spawn|delegate)$/i,
  code_edit: /^(code_edit|file_write|file_edit|edit)$/i,
  error: /^(error|failure|exception|crash)$/i,
  completion: /^(completion|complete|done|finish|success)$/i,
  system: /^(system|startup|shutdown|heartbeat|health_check|status)$/i,
};

/**
 * Extract summary from OpenClaw event payload
 */
function extractSummary(eventType: string, payload: Record<string, unknown>): string {
  switch (true) {
    case OPENCLAW_PATTERNS.tool_call.test(eventType): {
      const tool = payload.tool ?? payload.name ?? payload.function ?? "tool";
      return `调用 ${tool}`;
    }
    
    case OPENCLAW_PATTERNS.tool_result.test(eventType): {
      const tool = payload.tool ?? payload.name ?? "";
      if (tool) return `${tool} 执行完成`;
      return "工具执行完成";
    }
    
    case OPENCLAW_PATTERNS.message.test(eventType): {
      const message = payload.message as Record<string, unknown> | undefined;
      const content = message?.content ?? payload.content;
      if (typeof content === "string" && content.length > 10) {
        const cleaned = content
          .replace(/<relevant-memories>[\s\S]*?<\/relevant-memories>/g, "")
          .replace(/\[.*?\]/g, "")
          .trim();
        if (cleaned.length > 10) {
          return cleaned.slice(0, 150) + (cleaned.length > 150 ? "..." : "");
        }
      }
      return "消息";
    }
    
    case OPENCLAW_PATTERNS.thinking.test(eventType):
      return "思考中...";
    
    case OPENCLAW_PATTERNS.spawn.test(eventType): {
      const target = payload.agentId ?? payload.target ?? "子任务";
      return `派发任务给 ${target}`;
    }
    
    case OPENCLAW_PATTERNS.code_edit.test(eventType): {
      const file = payload.file ?? payload.path ?? "文件";
      return `编辑 ${file}`;
    }
    
    case OPENCLAW_PATTERNS.error.test(eventType): {
      const msg = payload.message ?? payload.error ?? "未知错误";
      return `错误: ${String(msg).slice(0, 100)}`;
    }
    
    case OPENCLAW_PATTERNS.completion.test(eventType): {
      const task = payload.task ?? payload.description ?? "";
      if (task) return `完成: ${String(task).slice(0, 100)}`;
      return "任务完成";
    }
    
    default:
      return `执行 ${eventType}`;
  }
}

/**
 * Calculate significance score for OpenClaw events
 */
function calculateSignificance(eventType: string, payload: Record<string, unknown>): number {
  // High significance events
  if (OPENCLAW_PATTERNS.error.test(eventType)) return 80;
  if (OPENCLAW_PATTERNS.completion.test(eventType)) return 70;
  if (OPENCLAW_PATTERNS.spawn.test(eventType)) return 60;
  
  // Medium significance
  if (OPENCLAW_PATTERNS.code_edit.test(eventType)) return 50;
  if (OPENCLAW_PATTERNS.tool_result.test(eventType)) return 40;
  
  // Lower significance
  if (OPENCLAW_PATTERNS.tool_call.test(eventType)) return 30;
  if (OPENCLAW_PATTERNS.message.test(eventType)) return 25;
  if (OPENCLAW_PATTERNS.thinking.test(eventType)) return 10;
  if (OPENCLAW_PATTERNS.system.test(eventType)) return 5;
  
  // Check payload for significance hints
  const score = payload.significance_score ?? payload.significanceScore ?? payload.score;
  if (typeof score === "number") return Math.min(100, Math.max(0, score));
  
  return 20;
}

/**
 * OpenClaw plugin parser
 */
function openclawParser(
  eventType: string,
  payload: Json | null,
  metadata?: EventParserMetadata
): ParsedPluginEvent | null {
  // Check if this looks like an OpenClaw event
  const isOpenClawEvent = Object.values(OPENCLAW_PATTERNS).some((pattern) =>
    pattern.test(eventType)
  );
  
  if (!isOpenClawEvent) return null;
  
  const payloadObj = (payload && typeof payload === "object" && !Array.isArray(payload))
    ? payload as Record<string, unknown>
    : {};
  
  const summary = extractSummary(eventType, payloadObj);
  const significance = calculateSignificance(eventType, payloadObj);
  
  // Determine event type ID
  let eventTypeId = "openclaw:unknown";
  for (const [key, pattern] of Object.entries(OPENCLAW_PATTERNS)) {
    if (pattern.test(eventType)) {
      eventTypeId = `openclaw:${key}`;
      break;
    }
  }
  
  // Determine if should notify
  const shouldNotify = significance >= 70 || OPENCLAW_PATTERNS.error.test(eventType);
  
  return {
    eventTypeId,
    summary,
    significance,
    data: payloadObj,
    shouldNotify,
    notificationMessage: shouldNotify ? summary : undefined,
  };
}

/**
 * OpenClaw Plugin Definition
 */
export const openclawPlugin: EventPlugin = {
  id: "openclaw",
  name: "OpenClaw",
  version: "1.0.0",
  description: "Built-in plugin for OpenClaw agent events",
  author: "Agent Town",
  framework: "openclaw",
  
  eventTypes: [
    {
      id: "openclaw:tool_call",
      name: "Tool Call",
      description: "Agent invokes a tool or function",
      icon: "🔧",
      category: "tool_call",
      framework: "openclaw",
    },
    {
      id: "openclaw:tool_result",
      name: "Tool Result",
      description: "Result from a tool execution",
      icon: "⚙️",
      category: "tool_call",
      framework: "openclaw",
    },
    {
      id: "openclaw:message",
      name: "Message",
      description: "Conversation message",
      icon: "💬",
      category: "conversation",
      framework: "openclaw",
    },
    {
      id: "openclaw:thinking",
      name: "Thinking",
      description: "Agent reasoning process",
      icon: "💭",
      category: "completion",
      framework: "openclaw",
    },
    {
      id: "openclaw:spawn",
      name: "Spawn",
      description: "Spawning a sub-agent",
      icon: "🚀",
      category: "system",
      framework: "openclaw",
    },
    {
      id: "openclaw:code_edit",
      name: "Code Edit",
      description: "File or code modification",
      icon: "📝",
      category: "tool_call",
      framework: "openclaw",
    },
    {
      id: "openclaw:error",
      name: "Error",
      description: "Error or failure event",
      icon: "❌",
      category: "error",
      framework: "openclaw",
    },
    {
      id: "openclaw:completion",
      name: "Completion",
      description: "Task completion event",
      icon: "✅",
      category: "completion",
      framework: "openclaw",
    },
    {
      id: "openclaw:system",
      name: "System",
      description: "System-level event",
      icon: "⚡",
      category: "system",
      framework: "openclaw",
    },
  ],
  
  parser: openclawParser,
  
  notificationRules: [
    {
      id: "openclaw:error-notify",
      eventTypeIds: ["openclaw:error"],
      priority: "high",
      enabled: true,
    },
    {
      id: "openclaw:completion-notify",
      eventTypeIds: ["openclaw:completion"],
      priority: "normal",
      enabled: true,
    },
  ],
  
  displayTemplates: [
    {
      eventTypeId: "openclaw:tool_call",
      titleTemplate: "调用 {{tool}}",
      summaryTemplate: "{{summary}}",
      fields: [
        { key: "tool", label: "工具", type: "string", showInCompact: true },
        { key: "args", label: "参数", type: "json" },
      ],
    },
    {
      eventTypeId: "openclaw:error",
      titleTemplate: "错误",
      summaryTemplate: "{{message}}",
      fields: [
        { key: "message", label: "错误信息", type: "string", showInCompact: true },
        { key: "stack", label: "堆栈", type: "code" },
      ],
    },
  ],
};
