'use client';

import { useEffect, useState } from 'react';
import type { AgentStatus } from '@/lib/types';

interface AgentDetailModalProps {
  agent: AgentStatus | null;
  onClose: () => void;
}

function formatTimeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);

  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  return date.toLocaleDateString();
}

function formatTaskTime(dateStr: string | null): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'online':
      return '#00e436';
    case 'idle':
      return '#ffec27';
    case 'error':
      return '#ff004d';
    default:
      return '#83769c';
  }
}

function getStatusLabel(status: string): string {
  return status.toUpperCase();
}

function getStatusEmoji(status: string): string {
  switch (status) {
    case 'online':
      return '💻';
    case 'idle':
      return '☕';
    case 'error':
      return '🔥';
    default:
      return '💤';
  }
}

export function AgentDetailModal({ agent, onClose }: AgentDetailModalProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (agent) {
      setIsVisible(true);
    }
  }, [agent]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 150);
  };

  if (!agent) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-150 ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="agent-detail-title"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70" />

      {/* Modal */}
      <div
        className={`relative w-full max-w-sm mx-4 transform transition-transform duration-150 ${
          isVisible ? 'scale-100' : 'scale-95'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-4 border-[#5f574f] bg-[#1d2b53] p-0">
          {/* Header */}
          <div className="border-b-2 border-[#5f574f] bg-[#29366f] px-4 py-3 flex items-center justify-between">
            <h2
              id="agent-detail-title"
              className="font-pixel text-sm text-[#fff1e8] truncate"
            >
              {agent.agent_id}
            </h2>
            <button
              onClick={handleClose}
              className="font-pixel text-xs text-[#ff004d] hover:text-[#fff1e8] transition-colors"
              aria-label="Close modal"
            >
              [X]
            </button>
          </div>

          {/* Content */}
          <div className="p-4 space-y-4">
            {/* Status with emoji */}
            <div className="flex items-center gap-3">
              <span className="text-xl">{getStatusEmoji(agent.status)}</span>
              <div className="flex items-center gap-2">
                <span className="font-pixel text-[10px] text-[#c2c3c7]">STATUS:</span>
                <span
                  className="font-pixel text-xs"
                  style={{ color: getStatusColor(agent.status) }}
                >
                  {getStatusLabel(agent.status)}
                </span>
                <span
                  className="w-2 h-2 rounded-full animate-pulse"
                  style={{ backgroundColor: getStatusColor(agent.status) }}
                />
              </div>
            </div>

            {/* Current Activity */}
            <div className="flex items-center gap-3">
              <span className="font-pixel text-[10px] text-[#c2c3c7]">DOING:</span>
              <span className="font-pixel text-xs text-[#fff1e8]">
                {agent.current_task?.description || (agent.status === 'online' ? 'Working on tasks' : agent.status === 'idle' ? 'Taking a break' : 'Offline')}
              </span>
            </div>

            {/* Task Start Time */}
            {agent.current_task?.started_at && (
              <div className="flex items-center gap-3">
                <span className="font-pixel text-[10px] text-[#c2c3c7]">STARTED:</span>
                <span className="font-pixel text-xs text-[#29adff]">
                  {formatTaskTime(agent.current_task.started_at)}
                </span>
              </div>
            )}

            {/* Last Activity */}
            <div className="flex items-center gap-3">
              <span className="font-pixel text-[10px] text-[#c2c3c7]">LAST ACTIVITY:</span>
              <span className="font-pixel text-xs text-[#fff1e8]">
                {formatTimeAgo(agent.last_event_at)}
              </span>
            </div>

            {/* Last Event Type */}
            {agent.last_event_type && (
              <div className="flex items-center gap-3">
                <span className="font-pixel text-[10px] text-[#c2c3c7]">LAST EVENT:</span>
                <span className="font-pixel text-xs text-[#ffa300]">
                  {agent.last_event_type}
                </span>
              </div>
            )}

            {/* 24h Stats */}
            <div className="mt-4 p-3 bg-[#000000]/50 border border-[#5f574f]">
              <div className="font-pixel text-[10px] text-[#c2c3c7] mb-2">24H STATISTICS</div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="font-pixel text-[8px] text-[#83769c]">EVENTS</span>
                  <div className="font-pixel text-sm text-[#29adff]">{agent.event_count_24h}</div>
                </div>
                <div>
                  <span className="font-pixel text-[8px] text-[#83769c]">UPTIME</span>
                  <div className="font-pixel text-sm text-[#00e436]">
                    {agent.status === 'online' ? '~Active' : '~Idle'}
                  </div>
                </div>
              </div>
            </div>

            {/* Activity Bar */}
            <div className="mt-2">
              <div className="font-pixel text-[10px] text-[#c2c3c7] mb-2">ACTIVITY LEVEL</div>
              <div className="h-3 bg-[#000000] border border-[#5f574f]">
                <div
                  className="h-full transition-all duration-300"
                  style={{
                    width: `${Math.min(100, agent.event_count_24h)}%`,
                    backgroundColor: getStatusColor(agent.status),
                  }}
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t-2 border-[#5f574f] px-4 py-3">
            <button
              onClick={handleClose}
              className="w-full font-pixel text-xs text-[#c2c3c7] hover:text-[#fff1e8] border-2 border-[#5f574f] hover:border-[#fff1e8] py-2 transition-colors"
            >
              CLOSE
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
