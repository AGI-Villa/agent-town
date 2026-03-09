'use client';

import { useState, useEffect, useCallback } from 'react';
import type { AgentStatus } from '@/lib/types';

type StatusFilter = 'all' | 'online' | 'idle' | 'offline';

interface AgentListPanelProps {
  onAgentSelect: (agentId: string) => void;
}

const STATUS_ICONS: Record<string, string> = {
  online: '🟢',
  idle: '🟡',
  offline: '⚫',
};

export default function AgentListPanel({ onAgentSelect }: AgentListPanelProps) {
  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [isCollapsed, setIsCollapsed] = useState(false);

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch('/api/agents');
      if (!res.ok) return;
      const data: AgentStatus[] = await res.json();
      setAgents(data);
    } catch (err) {
      console.error('Failed to fetch agents:', err);
    }
  }, []);

  useEffect(() => {
    fetchAgents();
    const interval = setInterval(fetchAgents, 5000);
    return () => clearInterval(interval);
  }, [fetchAgents]);

  const filteredAgents = agents.filter((agent) => {
    const matchesSearch = agent.agent_id
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === 'all' || agent.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusCounts = {
    all: agents.length,
    online: agents.filter((a) => a.status === 'online').length,
    idle: agents.filter((a) => a.status === 'idle').length,
    offline: agents.filter((a) => a.status === 'offline').length,
  };

  if (isCollapsed) {
    return (
      <button
        onClick={() => setIsCollapsed(false)}
        className="absolute top-4 left-4 z-50 bg-[#1d2b53]/95 border-2 border-[#5f574f] rounded px-3 py-2 font-pixel text-xs text-[#fff1e8] hover:bg-[#29366f]"
      >
        👥 Agents ({agents.length})
      </button>
    );
  }

  return (
    <div className="absolute top-4 left-4 z-50 w-64 bg-[#1d2b53]/95 border-2 border-[#5f574f] rounded-lg shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#5f574f] px-3 py-2">
        <span className="font-pixel text-xs text-[#fff1e8]">👥 Agents</span>
        <button
          onClick={() => setIsCollapsed(true)}
          className="font-pixel text-xs text-[#c2c3c7] hover:text-[#ff004d]"
        >
          [−]
        </button>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-[#5f574f]">
        <input
          type="text"
          placeholder="Search..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-[#29366f] border border-[#5f574f] rounded px-2 py-1 font-pixel text-xs text-[#fff1e8] placeholder-[#83769c] focus:outline-none focus:border-[#29adff]"
        />
      </div>

      {/* Status Filter */}
      <div className="flex gap-1 px-3 py-2 border-b border-[#5f574f]">
        {(['all', 'online', 'idle', 'offline'] as StatusFilter[]).map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`flex-1 font-pixel text-[8px] py-1 rounded border ${
              statusFilter === status
                ? 'bg-[#29adff] border-[#29adff] text-[#1d2b53]'
                : 'bg-transparent border-[#5f574f] text-[#c2c3c7] hover:border-[#29adff]'
            }`}
          >
            {status === 'all' ? '全部' : STATUS_ICONS[status]} {statusCounts[status]}
          </button>
        ))}
      </div>

      {/* Agent List */}
      <div className="max-h-64 overflow-y-auto">
        {filteredAgents.length === 0 ? (
          <div className="px-3 py-4 text-center font-pixel text-xs text-[#83769c]">
            No agents found
          </div>
        ) : (
          filteredAgents.map((agent) => (
            <button
              key={agent.agent_id}
              onClick={() => onAgentSelect(agent.agent_id)}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[#29366f] transition-colors text-left border-b border-[#5f574f]/30 last:border-b-0"
            >
              <span className="text-sm">{STATUS_ICONS[agent.status]}</span>
              <span className="flex-1 font-pixel text-xs text-[#fff1e8] truncate">
                {agent.agent_id}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
