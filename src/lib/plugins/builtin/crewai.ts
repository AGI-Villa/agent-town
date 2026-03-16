/**
 * CrewAI Plugin
 * 
 * Plugin for parsing CrewAI framework events.
 * https://github.com/joaomdmoura/crewAI
 */

import type { Json } from "../../database.types";
import type { EventPlugin, ParsedPluginEvent, EventParserMetadata } from "../types";

/**
 * CrewAI event type patterns
 */
const CREWAI_PATTERNS = {
  task_start: /^(task_start|task_begin|start_task)$/i,
  task_complete: /^(task_complete|task_done|task_finish|task_end)$/i,
  agent_action: /^(agent_action|crew_action|action)$/i,
  tool_usage: /^(tool_usage|tool_use|use_tool)$/i,
  delegation: /^(delegation|delegate|hand_off)$/i,
  crew_kickoff: /^(crew_kickoff|kickoff|crew_start)$/i,
  crew_complete: /^(crew_complete|crew_done|crew_finish)$/i,
  thought: /^(thought|thinking|reasoning|chain_of_thought)$/i,
};

/**
 * Check if payload looks like a CrewAI event
 */
function isCrewAIPayload(payload: Record<string, unknown>): boolean {
  return (
    payload.crew !== undefined ||
    payload.task !== undefined ||
    payload.agent_role !== undefined ||
    payload.backstory !== undefined ||
    payload.expected_output !== undefined ||
    payload.delegation !== undefined
  );
}

/**
 * Extract summary from CrewAI event
 */
function extractSummary(eventType: string, payload: Record<string, unknown>): string {
  const agent = payload.agent ?? payload.agent_role ?? payload.role ?? "Agent";
  const task = payload.task ?? payload.task_description ?? "";
  
  switch (true) {
    case CREWAI_PATTERNS.task_start.test(eventType): {
      const taskDesc = typeof task === "string" ? task.slice(0, 80) : "任务";
      return `${agent} 开始: ${taskDesc}${String(task).length > 80 ? "..." : ""}`;
    }
    
    case CREWAI_PATTERNS.task_complete.test(eventType): {
      const output = payload.output ?? payload.result ?? "";
      if (typeof output === "string" && output.length > 10) {
        return `${agent} 完成: ${output.slice(0, 100)}${output.length > 100 ? "..." : ""}`;
      }
      return `${agent} 完成任务`;
    }
    
    case CREWAI_PATTERNS.agent_action.test(eventType): {
      const action = payload.action ?? payload.action_type ?? "操作";
      return `${agent} 执行: ${action}`;
    }
    
    case CREWAI_PATTERNS.tool_usage.test(eventType): {
      const tool = payload.tool ?? payload.tool_name ?? "工具";
      return `${agent} 使用 ${tool}`;
    }
    
    case CREWAI_PATTERNS.delegation.test(eventType): {
      const target = payload.delegated_to ?? payload.target_agent ?? "其他 Agent";
      return `${agent} 委派任务给 ${target}`;
    }
    
    case CREWAI_PATTERNS.crew_kickoff.test(eventType): {
      const crewName = payload.crew_name ?? payload.crew ?? "Crew";
      return `${crewName} 启动`;
    }
    
    case CREWAI_PATTERNS.crew_complete.test(eventType): {
      const crewName = payload.crew_name ?? payload.crew ?? "Crew";
      return `${crewName} 完成所有任务`;
    }
    
    case CREWAI_PATTERNS.thought.test(eventType): {
      const thought = payload.thought ?? payload.content ?? "";
      if (typeof thought === "string" && thought.length > 10) {
        return `${agent} 思考: ${thought.slice(0, 100)}${thought.length > 100 ? "..." : ""}`;
      }
      return `${agent} 思考中`;
    }
    
    default:
      return `${agent} 事件`;
  }
}

/**
 * Calculate significance for CrewAI events
 */
function calculateSignificance(eventType: string, payload: Record<string, unknown>): number {
  if (CREWAI_PATTERNS.crew_complete.test(eventType)) return 85;
  if (CREWAI_PATTERNS.task_complete.test(eventType)) return 70;
  if (CREWAI_PATTERNS.crew_kickoff.test(eventType)) return 65;
  if (CREWAI_PATTERNS.delegation.test(eventType)) return 55;
  if (CREWAI_PATTERNS.task_start.test(eventType)) return 50;
  if (CREWAI_PATTERNS.tool_usage.test(eventType)) return 40;
  if (CREWAI_PATTERNS.agent_action.test(eventType)) return 35;
  if (CREWAI_PATTERNS.thought.test(eventType)) return 15;
  
  return 25;
}

/**
 * CrewAI plugin parser
 */
function crewaiParser(
  eventType: string,
  payload: Json | null,
  metadata?: EventParserMetadata
): ParsedPluginEvent | null {
  const payloadObj = (payload && typeof payload === "object" && !Array.isArray(payload))
    ? payload as Record<string, unknown>
    : {};
  
  // Check if this is a CrewAI event
  const isCrewAIEvent = 
    Object.values(CREWAI_PATTERNS).some((p) => p.test(eventType)) ||
    isCrewAIPayload(payloadObj);
  
  if (!isCrewAIEvent) return null;
  
  const summary = extractSummary(eventType, payloadObj);
  const significance = calculateSignificance(eventType, payloadObj);
  
  // Determine event type ID
  let eventTypeId = "crewai:unknown";
  for (const [key, pattern] of Object.entries(CREWAI_PATTERNS)) {
    if (pattern.test(eventType)) {
      eventTypeId = `crewai:${key}`;
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
 * CrewAI Plugin Definition
 */
export const crewaiPlugin: EventPlugin = {
  id: "crewai",
  name: "CrewAI",
  version: "1.0.0",
  description: "Plugin for CrewAI framework events",
  author: "Agent Town",
  framework: "crewai",
  
  eventTypes: [
    {
      id: "crewai:task_start",
      name: "Task Start",
      description: "Agent starts a task",
      icon: "🎬",
      category: "system",
      color: "#FF6B35",
      framework: "crewai",
    },
    {
      id: "crewai:task_complete",
      name: "Task Complete",
      description: "Agent completes a task",
      icon: "✅",
      category: "completion",
      color: "#FF6B35",
      framework: "crewai",
    },
    {
      id: "crewai:agent_action",
      name: "Agent Action",
      description: "Agent performs an action",
      icon: "⚡",
      category: "tool_call",
      color: "#FF6B35",
      framework: "crewai",
    },
    {
      id: "crewai:tool_usage",
      name: "Tool Usage",
      description: "Agent uses a tool",
      icon: "🔧",
      category: "tool_call",
      color: "#FF6B35",
      framework: "crewai",
    },
    {
      id: "crewai:delegation",
      name: "Delegation",
      description: "Task delegation between agents",
      icon: "🤝",
      category: "system",
      color: "#FF6B35",
      framework: "crewai",
    },
    {
      id: "crewai:crew_kickoff",
      name: "Crew Kickoff",
      description: "Crew starts execution",
      icon: "🚀",
      category: "system",
      color: "#FF6B35",
      framework: "crewai",
    },
    {
      id: "crewai:crew_complete",
      name: "Crew Complete",
      description: "Crew finishes all tasks",
      icon: "🏁",
      category: "completion",
      color: "#FF6B35",
      framework: "crewai",
    },
    {
      id: "crewai:thought",
      name: "Thought",
      description: "Agent reasoning process",
      icon: "💭",
      category: "completion",
      color: "#FF6B35",
      framework: "crewai",
    },
  ],
  
  parser: crewaiParser,
  
  notificationRules: [
    {
      id: "crewai:crew-complete-notify",
      eventTypeIds: ["crewai:crew_complete"],
      priority: "high",
      enabled: true,
    },
    {
      id: "crewai:task-complete-notify",
      eventTypeIds: ["crewai:task_complete"],
      priority: "normal",
      enabled: true,
    },
  ],
  
  displayTemplates: [
    {
      eventTypeId: "crewai:task_start",
      titleTemplate: "{{agent}} 开始任务",
      summaryTemplate: "{{task}}",
      fields: [
        { key: "agent", label: "Agent", type: "string", showInCompact: true },
        { key: "task", label: "任务", type: "string" },
        { key: "expected_output", label: "预期输出", type: "string" },
      ],
    },
    {
      eventTypeId: "crewai:task_complete",
      titleTemplate: "{{agent}} 完成任务",
      summaryTemplate: "{{output}}",
      fields: [
        { key: "agent", label: "Agent", type: "string", showInCompact: true },
        { key: "output", label: "输出", type: "string" },
        { key: "duration", label: "耗时", type: "duration" },
      ],
    },
    {
      eventTypeId: "crewai:delegation",
      titleTemplate: "任务委派",
      summaryTemplate: "{{agent}} → {{delegated_to}}",
      fields: [
        { key: "agent", label: "委派者", type: "string", showInCompact: true },
        { key: "delegated_to", label: "接收者", type: "string", showInCompact: true },
        { key: "reason", label: "原因", type: "string" },
      ],
    },
  ],
};
