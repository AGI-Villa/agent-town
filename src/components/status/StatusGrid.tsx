"use client";

import { useState, useEffect, useCallback } from "react";
import { AgentCard } from "./AgentCard";
import type { AgentStatus } from "@/lib/types";

const POLL_INTERVAL = 7000;

export function StatusGrid() {
  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch("/api/agents");
      if (!res.ok) throw new Error("Failed to fetch agents");
      const data: AgentStatus[] = await res.json();
      setAgents(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }, []);

  useEffect(() => {
    fetchAgents().finally(() => setLoading(false));
  }, [fetchAgents]);

  useEffect(() => {
    const interval = setInterval(fetchAgents, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchAgents]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16" role="status" aria-label="Loading">
        <div className="font-pixel text-sm text-[#c2c3c7] animate-pulse">
          LOADING AGENTS...
        </div>
      </div>
    );
  }

  if (error && agents.length === 0) {
    return (
      <div className="py-16 text-center" role="alert">
        <p className="font-pixel text-sm text-[#ff004d]">{error}</p>
        <button
          onClick={() => {
            setLoading(true);
            setError(null);
            fetchAgents().finally(() => setLoading(false));
          }}
          className="mt-4 rounded-none border-2 border-[#ff004d] px-4 py-2 font-pixel text-xs text-[#ff004d] hover:bg-[#ff004d] hover:text-[#000000] transition-colors"
        >
          RETRY
        </button>
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="font-pixel text-sm text-[#c2c3c7]">
          NO AGENTS FOUND
        </p>
        <p className="mt-2 font-pixel text-[10px] text-[#83769c]">
          Start the watcher to see agents appear here
        </p>
      </div>
    );
  }

  const onlineCount = agents.filter((a) => a.status === "online").length;
  const idleCount = agents.filter((a) => a.status === "idle").length;
  const offlineCount = agents.filter((a) => a.status === "offline").length;

  return (
    <div>
      {/* Summary bar */}
      <div className="mb-6 flex flex-wrap items-center gap-4 rounded-none border-2 border-[#5f574f] bg-[#1d2b53]/60 px-4 py-3">
        <span className="font-pixel text-[10px] text-[#c2c3c7]">
          TOTAL: <span className="text-[#fff1e8]">{agents.length}</span>
        </span>
        <span className="font-pixel text-[10px] text-[#00e436]">
          ONLINE: {onlineCount}
        </span>
        <span className="font-pixel text-[10px] text-[#ffec27]">
          IDLE: {idleCount}
        </span>
        <span className="font-pixel text-[10px] text-[#83769c]">
          OFFLINE: {offlineCount}
        </span>
      </div>

      {/* Agent grid */}
      <div
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        role="list"
        aria-label="Agent status cards"
      >
        {agents.map((agent) => (
          <div key={agent.agent_id} role="listitem">
            <AgentCard agent={agent} />
          </div>
        ))}
      </div>
    </div>
  );
}
