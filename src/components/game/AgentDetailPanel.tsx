'use client';

import { useEffect, useState } from 'react';

interface AgentDetail {
  agent_id: string;
  name: string;
  role: string;
  status: 'online' | 'idle' | 'offline';
  currentTask: string;
  todayStats: { total: number; byType: Record<string, number> };
  recentEvents: Array<{ type: string; summary: string; time: string }>;
  latestMoment: { content: string; time: string } | null;
}

interface AgentDetailPanelProps {
  agentId: string | null;
  onClose: () => void;
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'online': return '#00e436';
    case 'idle': return '#ffec27';
    default: return '#83769c';
  }
}

function getStatusEmoji(status: string): string {
  switch (status) {
    case 'online': return '💻';
    case 'idle': return '☕';
    default: return '💤';
  }
}

export function AgentDetailPanel({ agentId, onClose }: AgentDetailPanelProps) {
  const [detail, setDetail] = useState<AgentDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!agentId) {
      setIsVisible(false);
      return;
    }

    setLoading(true);
    fetch(`/api/agents/${agentId}/detail`)
      .then((res) => res.json())
      .then((data) => {
        setDetail(data);
        setIsVisible(true);
      })
      .catch((err) => console.error('Failed to fetch agent detail:', err))
      .finally(() => setLoading(false));
  }, [agentId]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 200);
  };

  if (!agentId) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/50 z-40 transition-opacity duration-200 ${
          isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={handleClose}
      />

      {/* Slide-in Panel */}
      <div
        className={`fixed top-0 right-0 h-full w-80 max-w-[90vw] bg-[#1d2b53] border-l-4 border-[#5f574f] z-50 transform transition-transform duration-200 ease-out overflow-y-auto ${
          isVisible ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="sticky top-0 bg-[#29366f] border-b-2 border-[#5f574f] px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">{detail ? getStatusEmoji(detail.status) : '👤'}</span>
            <div>
              <h2 className="font-pixel text-sm text-[#fff1e8]">
                {loading ? '...' : detail?.name || agentId}
              </h2>
              <p className="font-pixel text-[8px] text-[#c2c3c7]">
                {detail?.role || ''}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="font-pixel text-xs text-[#ff004d] hover:text-[#fff1e8] transition-colors px-2 py-1"
            aria-label="Close panel"
          >
            [X]
          </button>
        </div>

        {loading ? (
          <div className="p-4 text-center">
            <span className="font-pixel text-xs text-[#c2c3c7] animate-pulse">Loading...</span>
          </div>
        ) : detail ? (
          <div className="p-4 space-y-4">
            {/* Status */}
            <div className="flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full animate-pulse"
                style={{ backgroundColor: getStatusColor(detail.status) }}
              />
              <span
                className="font-pixel text-xs"
                style={{ color: getStatusColor(detail.status) }}
              >
                {detail.status.toUpperCase()}
              </span>
            </div>

            {/* Current Task */}
            {detail.currentTask && (
              <div className="bg-[#000]/30 border border-[#5f574f] p-3 rounded">
                <div className="font-pixel text-[8px] text-[#c2c3c7] mb-1">当前任务</div>
                <div className="font-pixel text-sm text-[#fff1e8] leading-relaxed">
                  {detail.currentTask}
                </div>
              </div>
            )}

            {/* Today Stats */}
            <div className="bg-[#000]/30 border border-[#5f574f] p-3 rounded">
              <div className="font-pixel text-[8px] text-[#c2c3c7] mb-2">今日统计</div>
              <div className="flex items-center gap-4">
                <div>
                  <div className="font-pixel text-lg text-[#29adff]">{detail.todayStats.total}</div>
                  <div className="font-pixel text-[8px] text-[#83769c]">事件</div>
                </div>
                <div className="flex-1 flex flex-wrap gap-1">
                  {Object.entries(detail.todayStats.byType).slice(0, 4).map(([type, count]) => (
                    <span
                      key={type}
                      className="font-pixel text-[8px] text-[#c2c3c7] bg-[#5f574f]/30 px-1 py-0.5 rounded"
                    >
                      {type}: {count}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Recent Events */}
            <div>
              <div className="font-pixel text-[8px] text-[#c2c3c7] mb-2">最近动态</div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {detail.recentEvents.length > 0 ? (
                  detail.recentEvents.map((ev, i) => (
                    <div
                      key={i}
                      className="bg-[#000]/20 border border-[#5f574f]/50 p-2 rounded"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-pixel text-[8px] text-[#ffa300]">{ev.type}</span>
                        <span className="font-pixel text-[8px] text-[#83769c]">{ev.time}</span>
                      </div>
                      <div className="font-pixel text-[10px] text-[#c2c3c7] leading-relaxed break-words">
                        {ev.summary}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="font-pixel text-[10px] text-[#83769c] text-center py-2">
                    暂无动态
                  </div>
                )}
              </div>
            </div>

            {/* Latest Moment */}
            {detail.latestMoment && (
              <div className="bg-[#29366f]/50 border border-[#5f574f] p-3 rounded">
                <div className="font-pixel text-[8px] text-[#c2c3c7] mb-1 flex items-center gap-1">
                  <span>📝</span> 最新朋友圈
                  <span className="text-[#83769c] ml-auto">{detail.latestMoment.time}</span>
                </div>
                <div className="font-pixel text-[10px] text-[#fff1e8] leading-relaxed">
                  {detail.latestMoment.content}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 text-center">
            <span className="font-pixel text-xs text-[#ff004d]">加载失败</span>
          </div>
        )}
      </div>
    </>
  );
}
