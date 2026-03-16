'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  TokenTrendChart,
  AgentDistributionChart,
  AgentRankingList,
} from '@/components/analytics/TokenChart';

type Period = 'day' | 'week' | 'month';

interface Summary {
  total_tokens: number;
  total_cost: number;
  prompt_tokens: number;
  completion_tokens: number;
  period: string;
}

interface AgentData {
  agent_id: string;
  tokens: number;
  cost: number;
}

interface TrendData {
  date: string;
  tokens: number;
  cost: number;
}

interface AnalyticsData {
  summary: Summary;
  by_agent: AgentData[];
  trend: TrendData[];
}

function formatTokens(tokens: number): string {
  if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(2)}M`;
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`;
  return tokens.toString();
}

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<Period>('day');
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    
    const fetchData = async () => {
      try {
        const res = await fetch(`/api/analytics/tokens?period=${period}`);
        const result = await res.json();
        if (!cancelled) {
          setData(result);
          setLoading(false);
        }
      } catch (err) {
        console.error('Failed to fetch analytics:', err);
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchData();
    
    return () => {
      cancelled = true;
    };
  }, [period]);

  const periodLabels: Record<Period, string> = {
    day: '今日',
    week: '本周',
    month: '本月',
  };

  return (
    <div className="min-h-screen bg-[#1d2b53] text-[#fff1e8]">
      {/* Header */}
      <header className="bg-[#29366f] border-b-4 border-[#5f574f] px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="font-pixel text-xs text-[#c2c3c7] hover:text-[#fff1e8] transition-colors"
            >
              ← 返回
            </Link>
            <h1 className="font-pixel text-lg">📊 Token 消耗分析</h1>
          </div>
          <div className="flex gap-2">
            {(['day', 'week', 'month'] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`font-pixel text-xs px-3 py-1 rounded border-2 transition-colors ${
                  period === p
                    ? 'bg-[#29adff] border-[#29adff] text-[#000]'
                    : 'bg-transparent border-[#5f574f] text-[#c2c3c7] hover:border-[#29adff]'
                }`}
              >
                {periodLabels[p]}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 space-y-6">
        {loading ? (
          <div className="text-center py-12">
            <span className="font-pixel text-sm text-[#c2c3c7] animate-pulse">
              Loading...
            </span>
          </div>
        ) : data ? (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-[#29366f] border-2 border-[#5f574f] rounded p-4">
                <div className="font-pixel text-[10px] text-[#83769c] mb-1">
                  总 Token
                </div>
                <div className="font-pixel text-2xl text-[#29adff]">
                  {formatTokens(data.summary.total_tokens)}
                </div>
              </div>
              <div className="bg-[#29366f] border-2 border-[#5f574f] rounded p-4">
                <div className="font-pixel text-[10px] text-[#83769c] mb-1">
                  预估成本
                </div>
                <div className="font-pixel text-2xl text-[#00e436]">
                  ${data.summary.total_cost.toFixed(4)}
                </div>
              </div>
              <div className="bg-[#29366f] border-2 border-[#5f574f] rounded p-4">
                <div className="font-pixel text-[10px] text-[#83769c] mb-1">
                  输入 Token
                </div>
                <div className="font-pixel text-2xl text-[#ffa300]">
                  {formatTokens(data.summary.prompt_tokens)}
                </div>
              </div>
              <div className="bg-[#29366f] border-2 border-[#5f574f] rounded p-4">
                <div className="font-pixel text-[10px] text-[#83769c] mb-1">
                  输出 Token
                </div>
                <div className="font-pixel text-2xl text-[#ff77a8]">
                  {formatTokens(data.summary.completion_tokens)}
                </div>
              </div>
            </div>

            {/* Charts Row */}
            <div className="grid md:grid-cols-2 gap-4">
              {/* Trend Chart */}
              <div className="bg-[#29366f] border-2 border-[#5f574f] rounded p-4">
                <h2 className="font-pixel text-sm mb-4">📈 消耗趋势</h2>
                <TokenTrendChart data={data.trend} />
              </div>

              {/* Distribution Chart */}
              <div className="bg-[#29366f] border-2 border-[#5f574f] rounded p-4">
                <h2 className="font-pixel text-sm mb-4">🥧 Agent 分布</h2>
                <AgentDistributionChart data={data.by_agent} />
              </div>
            </div>

            {/* Ranking */}
            <div className="bg-[#29366f] border-2 border-[#5f574f] rounded p-4">
              <h2 className="font-pixel text-sm mb-4">🏆 Agent 消耗排行</h2>
              <AgentRankingList data={data.by_agent} />
            </div>
          </>
        ) : (
          <div className="text-center py-12">
            <span className="font-pixel text-sm text-[#ff004d]">加载失败</span>
          </div>
        )}
      </main>
    </div>
  );
}
