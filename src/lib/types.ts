export interface AgentStatus {
  agent_id: string;
  status: "online" | "idle" | "offline";
  last_event_at: string | null;
  event_count_24h: number;
  last_event_type: string | null;
}
