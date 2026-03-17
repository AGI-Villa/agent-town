/**
 * AutoGen Plugin
 * 
 * Plugin for parsing Microsoft AutoGen framework events.
 * https://github.com/microsoft/autogen
 */

import type { Json } from "../../database.types";
import type { EventPlugin, ParsedPluginEvent, EventParserMetadata } from "../types";

/**
 * AutoGen event type patterns
 */
const AUTOGEN_PATTERNS = {
  agent_message: /^(agent_message|assistant_agent|user_proxy)$/i,
  function_call: /^(function_call|tool_use|execute_function)$/i,
  code_execution: /^(code_execution|execute_code|code_block)$/i,
  group_chat: /^(group_chat|groupchat|multi_agent)$/i,
  termination: /^(termination|terminate|stop|end)$/i,
  human_input: /^(human_input|user_input|await_human)$/i,
};

/**
 * Check if payload looks like an AutoGen event
 */
function isAutoGenPayload(payload: Record<string, unknown>): boolean {
  // AutoGen specific fields
  return (
    payload.sender !== undefined ||
    payload.recipient !== undefined ||
    payload.groupchat !== undefined ||
    payload.code_execution_config !== undefined ||
    payload.llm_config !== undefined ||
    payload.human_input_mode !== undefined
  );
}

/**
 * Extract summary from AutoGen event
 */
function extractSummary(eventType: string, payload: Record<string, unknown>): string {
  const sender = payload.sender ?? payload.agent_name ?? "Agent";
  const recipient = payload.recipient ?? "";
  
  switch (true) {
    case AUTOGEN_PATTERNS.agent_message.test(eventType): {
      const content = payload.content ?? payload.message ?? "";
      if (typeof content === "string" && content.length > 10) {
        return `${sender}: ${content.slice(0, 120)}${content.length > 120 ? "..." : ""}`;
      }
      return `${sender} 发送消息`;
    }
    
    case AUTOGEN_PATTERNS.function_call.test(eventType): {
      const funcName = payload.function_name ?? payload.name ?? "function";
      return `${sender} 调用 ${funcName}`;
    }
    
    case AUTOGEN_PATTERNS.code_execution.test(eventType): {
      const lang = payload.language ?? "code";
      return `${sender} 执行 ${lang} 代码`;
    }
    
    case AUTOGEN_PATTERNS.group_chat.test(eventType): {
      const participants = payload.participants ?? payload.agents ?? [];
      const count = Array.isArray(participants) ? participants.length : 0;
      return `群聊 (${count} 个 Agent)`;
    }
    
    case AUTOGEN_PATTERNS.termination.test(eventType):
      return `${sender} 终止对话`;
    
    case AUTOGEN_PATTERNS.human_input.test(eventType):
      return `等待人类输入`;
    
    default:
      if (recipient) return `${sender} → ${recipient}`;
      return `${sender} 事件`;
  }
}

/**
 * Calculate significance for AutoGen events
 */
function calculateSignificance(eventType: string, payload: Record<string, unknown>): number {
  if (AUTOGEN_PATTERNS.termination.test(eventType)) return 70;
  if (AUTOGEN_PATTERNS.code_execution.test(eventType)) return 60;
  if (AUTOGEN_PATTERNS.function_call.test(eventType)) return 50;
  if (AUTOGEN_PATTERNS.human_input.test(eventType)) return 45;
  if (AUTOGEN_PATTERNS.group_chat.test(eventType)) return 40;
  if (AUTOGEN_PATTERNS.agent_message.test(eventType)) return 30;
  
  return 25;
}

/**
 * AutoGen plugin parser
 */
function autogenParser(
  eventType: string,
  payload: Json | null,
  metadata?: EventParserMetadata
): ParsedPluginEvent | null {
  const payloadObj = (payload && typeof payload === "object" && !Array.isArray(payload))
    ? payload as Record<string, unknown>
    : {};
  
  // Check if this is an AutoGen event
  const isAutoGenEvent = 
    Object.values(AUTOGEN_PATTERNS).some((p) => p.test(eventType)) ||
    isAutoGenPayload(payloadObj);
  
  if (!isAutoGenEvent) return null;
  
  const summary = extractSummary(eventType, payloadObj);
  const significance = calculateSignificance(eventType, payloadObj);
  
  // Determine event type ID
  let eventTypeId = "autogen:unknown";
  for (const [key, pattern] of Object.entries(AUTOGEN_PATTERNS)) {
    if (pattern.test(eventType)) {
      eventTypeId = `autogen:${key}`;
      break;
    }
  }
  
  return {
    eventTypeId,
    summary,
    significance,
    data: payloadObj,
    shouldNotify: significance >= 70,
  };
}

/**
 * AutoGen Plugin Definition
 */
export const autogenPlugin: EventPlugin = {
  id: "autogen",
  name: "AutoGen",
  version: "1.0.0",
  description: "Plugin for Microsoft AutoGen framework events",
  author: "Agent Town",
  framework: "autogen",
  
  eventTypes: [
    {
      id: "autogen:agent_message",
      name: "Agent Message",
      description: "Message from an AutoGen agent",
      icon: "🤖",
      category: "conversation",
      color: "#0078D4",
      framework: "autogen",
    },
    {
      id: "autogen:function_call",
      name: "Function Call",
      description: "Agent calls a function",
      icon: "⚡",
      category: "tool_call",
      color: "#0078D4",
      framework: "autogen",
    },
    {
      id: "autogen:code_execution",
      name: "Code Execution",
      description: "Agent executes code",
      icon: "💻",
      category: "tool_call",
      color: "#0078D4",
      framework: "autogen",
    },
    {
      id: "autogen:group_chat",
      name: "Group Chat",
      description: "Multi-agent group chat event",
      icon: "👥",
      category: "conversation",
      color: "#0078D4",
      framework: "autogen",
    },
    {
      id: "autogen:termination",
      name: "Termination",
      description: "Conversation termination",
      icon: "🛑",
      category: "completion",
      color: "#0078D4",
      framework: "autogen",
    },
    {
      id: "autogen:human_input",
      name: "Human Input",
      description: "Awaiting human input",
      icon: "👤",
      category: "conversation",
      color: "#0078D4",
      framework: "autogen",
    },
  ],
  
  parser: autogenParser,
  
  notificationRules: [
    {
      id: "autogen:termination-notify",
      eventTypeIds: ["autogen:termination"],
      priority: "normal",
      enabled: true,
    },
    {
      id: "autogen:human-input-notify",
      eventTypeIds: ["autogen:human_input"],
      priority: "high",
      enabled: true,
    },
  ],
  
  displayTemplates: [
    {
      eventTypeId: "autogen:agent_message",
      titleTemplate: "{{sender}}",
      summaryTemplate: "{{content}}",
      fields: [
        { key: "sender", label: "发送者", type: "string", showInCompact: true },
        { key: "recipient", label: "接收者", type: "string" },
        { key: "content", label: "内容", type: "string" },
      ],
    },
    {
      eventTypeId: "autogen:code_execution",
      titleTemplate: "代码执行",
      summaryTemplate: "{{language}} 代码",
      fields: [
        { key: "language", label: "语言", type: "string", showInCompact: true },
        { key: "code", label: "代码", type: "code" },
        { key: "output", label: "输出", type: "string" },
      ],
    },
  ],
};
