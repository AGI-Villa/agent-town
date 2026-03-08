"use client";

import { cn } from "@/lib/utils";

const PIXEL_COLORS = [
  "bg-rose-400",
  "bg-amber-400",
  "bg-emerald-400",
  "bg-sky-400",
  "bg-violet-400",
  "bg-pink-400",
  "bg-teal-400",
  "bg-orange-400",
];

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

function generatePixelPattern(agentId: string): boolean[][] {
  const hash = hashString(agentId);
  const pattern: boolean[][] = [];
  for (let row = 0; row < 5; row++) {
    pattern[row] = [];
    for (let col = 0; col < 3; col++) {
      const bit = (hash >> (row * 3 + col)) & 1;
      pattern[row][col] = bit === 1;
    }
    pattern[row][4] = pattern[row][0];
    pattern[row][3] = pattern[row][1];
  }
  return pattern;
}

interface AgentAvatarProps {
  agentId: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function AgentAvatar({ agentId, size = "md", className }: AgentAvatarProps) {
  const pattern = generatePixelPattern(agentId);
  const colorIndex = hashString(agentId) % PIXEL_COLORS.length;
  const color = PIXEL_COLORS[colorIndex];

  const sizeMap = { sm: "w-8 h-8", md: "w-10 h-10", lg: "w-14 h-14" };
  const pixelSize = { sm: "w-[5px] h-[5px]", md: "w-[6px] h-[6px]", lg: "w-[9px] h-[9px]" };

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-lg bg-muted p-0.5",
        sizeMap[size],
        className,
      )}
      role="img"
      aria-label={`Avatar for agent ${agentId}`}
    >
      <div className="grid grid-cols-5 gap-px">
        {pattern.flat().map((filled, i) => (
          <div
            key={i}
            className={cn(pixelSize[size], "rounded-[1px]", filled ? color : "bg-transparent")}
          />
        ))}
      </div>
    </div>
  );
}
