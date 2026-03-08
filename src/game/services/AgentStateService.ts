import type { AgentStatus } from '@/lib/types';

export type AgentStateChangeHandler = (
  added: AgentStatus[],
  updated: AgentStatus[],
  removed: string[]
) => void;

export class AgentStateService {
  private agents: Map<string, AgentStatus> = new Map();
  private pollInterval: number | null = null;
  private handlers: Set<AgentStateChangeHandler> = new Set();
  private pollIntervalMs: number;

  constructor(pollIntervalMs = 5000) {
    this.pollIntervalMs = pollIntervalMs;
  }

  subscribe(handler: AgentStateChangeHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  private notifyHandlers(
    added: AgentStatus[],
    updated: AgentStatus[],
    removed: string[]
  ): void {
    this.handlers.forEach((handler) => handler(added, updated, removed));
  }

  async fetchAgents(): Promise<AgentStatus[]> {
    try {
      const res = await fetch('/api/agents');
      if (!res.ok) throw new Error('Failed to fetch agents');
      return await res.json();
    } catch (err) {
      console.error('[AgentStateService] Fetch error:', err);
      return [];
    }
  }

  private processUpdate(newAgents: AgentStatus[]): void {
    const newAgentMap = new Map(newAgents.map((a) => [a.agent_id, a]));
    const added: AgentStatus[] = [];
    const updated: AgentStatus[] = [];
    const removed: string[] = [];

    // Check for new and updated agents
    for (const agent of newAgents) {
      const existing = this.agents.get(agent.agent_id);
      if (!existing) {
        added.push(agent);
      } else if (this.hasChanged(existing, agent)) {
        updated.push(agent);
      }
    }

    // Check for removed agents
    for (const agentId of this.agents.keys()) {
      if (!newAgentMap.has(agentId)) {
        removed.push(agentId);
      }
    }

    // Update internal state
    this.agents = newAgentMap;

    // Notify if there are changes
    if (added.length > 0 || updated.length > 0 || removed.length > 0) {
      this.notifyHandlers(added, updated, removed);
    }
  }

  private hasChanged(oldAgent: AgentStatus, newAgent: AgentStatus): boolean {
    return (
      oldAgent.status !== newAgent.status ||
      oldAgent.last_event_at !== newAgent.last_event_at ||
      oldAgent.event_count_24h !== newAgent.event_count_24h ||
      oldAgent.last_event_type !== newAgent.last_event_type
    );
  }

  async start(): Promise<void> {
    if (this.pollInterval !== null) return;

    // Initial fetch
    const agents = await this.fetchAgents();
    this.processUpdate(agents);

    // Start polling
    this.pollInterval = window.setInterval(async () => {
      const agents = await this.fetchAgents();
      this.processUpdate(agents);
    }, this.pollIntervalMs);
  }

  stop(): void {
    if (this.pollInterval !== null) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  getAgents(): AgentStatus[] {
    return Array.from(this.agents.values());
  }

  getAgent(agentId: string): AgentStatus | undefined {
    return this.agents.get(agentId);
  }

  isRunning(): boolean {
    return this.pollInterval !== null;
  }
}

// Singleton instance
let serviceInstance: AgentStateService | null = null;

export function getAgentStateService(): AgentStateService {
  if (!serviceInstance) {
    serviceInstance = new AgentStateService(5000);
  }
  return serviceInstance;
}
