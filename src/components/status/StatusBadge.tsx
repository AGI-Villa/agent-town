"use client";

import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: "online" | "idle" | "offline";
  className?: string;
}

const STATUS_CONFIG = {
  online: {
    label: "ONLINE",
    dotClass: "bg-[#00e436]", // Pico-8 green
    textClass: "text-[#00e436]",
    borderClass: "border-[#00e436]",
  },
  idle: {
    label: "IDLE",
    dotClass: "bg-[#ffec27]", // Pico-8 yellow
    textClass: "text-[#ffec27]",
    borderClass: "border-[#ffec27]",
  },
  offline: {
    label: "OFFLINE",
    dotClass: "bg-[#83769c]", // Pico-8 lavender
    textClass: "text-[#83769c]",
    borderClass: "border-[#83769c]",
  },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-none border-2 px-2 py-0.5",
        config.borderClass,
        className,
      )}
      role="status"
      aria-label={`Agent is ${status}`}
    >
      <span
        className={cn("h-2 w-2 rounded-none", config.dotClass, status === "online" && "animate-pulse")}
        aria-hidden="true"
      />
      <span
        className={cn("font-pixel text-[10px] uppercase tracking-wider", config.textClass)}
      >
        {config.label}
      </span>
    </div>
  );
}
