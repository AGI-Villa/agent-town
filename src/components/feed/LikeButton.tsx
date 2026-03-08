"use client";

import { useState, useTransition } from "react";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";

interface LikeButtonProps {
  momentId: string;
  initialLikes: number;
}

export function LikeButton({ momentId, initialLikes }: LikeButtonProps) {
  const [likes, setLikes] = useState(initialLikes);
  const [liked, setLiked] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleLike() {
    if (isPending) return;
    startTransition(async () => {
      try {
        const res = await fetch(`/api/moments/${momentId}/like`, { method: "POST" });
        if (!res.ok) throw new Error("Failed to like");
        const data = await res.json();
        setLikes(data.likes);
        setLiked(true);
      } catch {
        // Silently fail for MVP
      }
    });
  }

  return (
    <button
      onClick={handleLike}
      disabled={isPending}
      className={cn(
        "flex items-center gap-1 rounded-md px-2 py-1 text-sm transition-colors",
        liked ? "text-rose-500" : "text-muted-foreground hover:text-rose-500",
        isPending && "opacity-50",
      )}
      aria-label={`Like this moment. Current likes: ${likes}`}
    >
      <Heart className={cn("h-4 w-4", liked && "fill-current")} aria-hidden="true" />
      <span>{likes}</span>
    </button>
  );
}
