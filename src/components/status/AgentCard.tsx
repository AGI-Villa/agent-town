"use client";

import { cn } from "@/lib/utils";
import { AgentAvatar } from "@/components/feed/AgentAvatar";
import { StatusBadge } from "./StatusBadge";
import type { AgentStatus } from "@/lib/types";

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diff = now - date;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const EVENT_TYPE_ICONS: Record<string, string> = {
  "file.create": "📄",
  "file.modify": "✏️",
  "file.delete": "🗑️",
  "git.commit": "📦",
  "git.push": "🚀",
  "shell.command": "💻",
  "process.start": "▶️",
  "process.end": "⏹️",
};

interface AgentCardProps {
  agent: AgentStatus;
  className?: string;
}

export function AgentCard({ agent, className }: AgentCardProps) {
  const borderColor =
    agent.status === "online"
      ? "border-[#00e436]"
      : agent.status === "idle"
        ? "border-[#ffec27]"
        : "border-[#5f574f]";

  const bgColor =
    agent.status === "online"
      ? "bg-[#1d2b53]"
      : agent.status === "idle"
        ? "bg-[#1d2b53]/80"
        : "bg-[#1d2b53]/50";

  const eventIcon = agent.last_event_type
    ? EVENT_TYPE_ICONS[agent.last_event_type] || "⚡"
    : null;

  return (
    <div
      className={cn(
        "relative rounded-none border-4 p-4 transition-all",
        borderColor,
        bgColor,
        "shadow-[4px_4px_0px_0px_rgba(0,0,0,0.5)]",
        "hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,0.5)]",
        "hover:-translate-x-0.5 hover:-translate-y-0.5",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <AgentAvatar agentId={agent.agent_id} size="lg" />
          <div className="min-w-0">
            <h3 className="truncate font-pixel text-sm text-[#fff1e8]">
              {agent.agent_id}
            </h3>
            <StatusBadge status={agent.status} className="mt-1" />
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-2 border-t-2 border-[#5f574f] pt-3">
        {agent.last_event_at && (
          <div className="flex items-center justify-between">
            <span className="font-pixel text-[10px] text-[#c2c3c7]">LAST SEEN</span>
            <span className="font-pixel text-[10px] text-[#fff1e8]">
              {formatRelativeTime(agent.last_event_at)}
            </span>
          </div>
        )}

        {agent.last_event_type && (
          <div className="flex items-center justify-between">
            <span className="font-pixel text-[10px] text-[#c2c3c7]">ACTIVITY</span>
            <span className="font-pixel text-[10px] text-[#fff1e8]">
              {eventIcon} {agent.last_event_type}
            </span>
          </div>
        )}

        <div className="flex items-center justify-between">
          <span className="font-pixel text-[10px] text-[#c2c3c7]">24H EVENTS</span>
          <span className="font-pixel text-[10px] text-[#ffa300]">
            {agent.event_count_24h}
          </span>
        </div>
      </div>
    </div>
  );
}
