/**
 * Unified agent configuration loader.
 *
 * Priority:
 *   1. OpenClaw auto-discovery (reads ~/.openclaw/openclaw.json + IDENTITY.md)
 *      → only on server-side, loaded dynamically to avoid bundling fs in client
 *   2. agents.json fallback (always available, including client components)
 */

export interface AgentConfig {
  name: string;
  role: string;
  personality: string;
}

interface DiscoveredAgentLike {
  id: string;
  name: string;
  role: string | null;
  personality: string | null;
  hasSessionLogs: boolean;
}

// ── Static fallback from agents.json (always available, even at build time) ──

let staticAgents: Record<string, AgentConfig> = {};
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const json = require("../../agents.json");
  staticAgents = json.agents ?? {};
} catch {
  // agents.json doesn't exist — that's fine if OpenClaw discovery works
}

// ── Runtime cache (populated after first discover call, server-side only) ──

let runtimeAgents: Map<string, DiscoveredAgentLike> | null = null;
let runtimeInitPromise: Promise<void> | null = null;

async function ensureRuntime(): Promise<void> {
  if (runtimeAgents) return;
  if (typeof window !== "undefined") return;
  if (runtimeInitPromise) return runtimeInitPromise;

  runtimeInitPromise = import("./openclaw-discovery").then(async (mod) => {
    runtimeAgents = await mod.discoverAgents();
  });
  return runtimeInitPromise;
}

if (typeof window === "undefined") {
  ensureRuntime().catch(() => {});
}

// ── Public API ──

export function getAgentName(agentId: string): string {
  return (
    runtimeAgents?.get(agentId)?.name ??
    staticAgents[agentId]?.name ??
    agentId
  );
}

export function getAgentRole(agentId: string): string | null {
  return (
    runtimeAgents?.get(agentId)?.role ??
    staticAgents[agentId]?.role ??
    null
  );
}

export function getAgentPersonality(agentId: string): string | null {
  return (
    runtimeAgents?.get(agentId)?.personality ??
    staticAgents[agentId]?.personality ??
    null
  );
}

export function getAgentConfig(agentId: string): AgentConfig | null {
  const discovered = runtimeAgents?.get(agentId);
  if (discovered) {
    return {
      name: discovered.name,
      role: discovered.role ?? "Agent",
      personality: discovered.personality ?? "",
    };
  }
  return staticAgents[agentId] ?? null;
}

export function getAllAgentIds(): string[] {
  if (runtimeAgents && runtimeAgents.size > 0) {
    return [...runtimeAgents.keys()];
  }
  return Object.keys(staticAgents);
}

export function getActiveAgentIds(): string[] {
  if (runtimeAgents && runtimeAgents.size > 0) {
    return [...runtimeAgents.values()]
      .filter((a) => a.hasSessionLogs)
      .map((a) => a.id);
  }
  return Object.keys(staticAgents);
}

export function getAgentNames(): Record<string, string> {
  const result: Record<string, string> = {};
  if (runtimeAgents && runtimeAgents.size > 0) {
    for (const [id, agent] of runtimeAgents) {
      result[id] = agent.name;
    }
  } else {
    for (const [id, config] of Object.entries(staticAgents)) {
      result[id] = config.name;
    }
  }
  return result;
}

export function getAgentRoles(): Record<string, string> {
  const result: Record<string, string> = {};
  if (runtimeAgents && runtimeAgents.size > 0) {
    for (const [id, agent] of runtimeAgents) {
      if (agent.role) result[id] = agent.role;
    }
  } else {
    for (const [id, config] of Object.entries(staticAgents)) {
      result[id] = config.role;
    }
  }
  return result;
}

export async function ensureAgentsLoaded(): Promise<void> {
  return ensureRuntime();
}
