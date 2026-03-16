'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { MemoryEditor } from '@/components/memory/MemoryEditor';

interface AgentOption {
  id: string;
  name: string;
}

export default function MemoryPage() {
  const searchParams = useSearchParams();
  const initialAgent = searchParams.get('agent');

  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string>(initialAgent || '');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch available agents
    fetch('/api/agents')
      .then((res) => res.json())
      .then((data) => {
        const agentList: AgentOption[] = data.agents?.map((a: { agent_id: string; name: string }) => ({
          id: a.agent_id,
          name: a.name,
        })) || [];
        setAgents(agentList);
        // Auto-select first agent if none specified
        if (!selectedAgent && agentList.length > 0) {
          setSelectedAgent(agentList[0].id);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedAgent]);

  return (
    <div className="min-h-screen bg-[#1d2b53]">
      {/* Header */}
      <header className="bg-[#29366f] border-b-4 border-[#5f574f] px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/town"
              className="font-pixel text-xs text-[#c2c3c7] hover:text-[#fff1e8]"
            >
              ← 返回小镇
            </Link>
            <span className="text-[#5f574f]">|</span>
            <h1 className="font-pixel text-sm text-[#fff1e8] flex items-center gap-2">
              <span>🧠</span> Agent 记忆管理
            </h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto p-4">
        {/* Agent Selector */}
        <div className="mb-4">
          <label className="font-pixel text-[10px] text-[#c2c3c7] block mb-2">
            选择 Agent
          </label>
          <select
            value={selectedAgent}
            onChange={(e) => setSelectedAgent(e.target.value)}
            disabled={loading}
            className="w-full max-w-xs bg-[#000]/30 border border-[#5f574f] rounded px-3 py-2 font-pixel text-xs text-[#fff1e8] focus:outline-none focus:border-[#29adff]"
          >
            {loading ? (
              <option>加载中...</option>
            ) : agents.length === 0 ? (
              <option>无可用 Agent</option>
            ) : (
              agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name} ({agent.id})
                </option>
              ))
            )}
          </select>
        </div>

        {/* Memory Editor */}
        {selectedAgent && (
          <div className="bg-[#1d2b53] border-2 border-[#5f574f] rounded-lg overflow-hidden min-h-[60vh]">
            <MemoryEditor key={selectedAgent} agentId={selectedAgent} />
          </div>
        )}

        {!selectedAgent && !loading && (
          <div className="text-center py-16">
            <span className="font-pixel text-sm text-[#83769c]">
              请选择一个 Agent 查看记忆
            </span>
          </div>
        )}
      </main>
    </div>
  );
}
