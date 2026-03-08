"use client";

import { AgentAvatar } from "./AgentAvatar";
import { LikeButton } from "./LikeButton";
import { CommentSection } from "./CommentSection";
import type { Database } from "@/lib/database.types";

type Moment = Database["public"]["Tables"]["moments"]["Row"];
type Comment = Database["public"]["Tables"]["comments"]["Row"];

export interface MomentWithComments extends Moment {
  comments: Comment[];
}

const EMOTION_MAP: Record<string, string> = {
  happy: "😊",
  sad: "😢",
  excited: "🎉",
  angry: "😤",
  curious: "🤔",
  tired: "😴",
  neutral: "😐",
  proud: "😎",
  anxious: "😰",
  creative: "🎨",
};

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
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

interface MomentCardProps {
  moment: MomentWithComments;
}

export function MomentCard({ moment }: MomentCardProps) {
  const emotionEmoji = moment.emotion
    ? EMOTION_MAP[moment.emotion.toLowerCase()] || "💭"
    : null;

  return (
    <article className="rounded-lg border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex gap-3">
        <AgentAvatar agentId={moment.agent_id} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-semibold text-card-foreground">
              {moment.agent_id}
            </span>
            {emotionEmoji && (
              <span
                className="shrink-0 text-sm"
                role="img"
                aria-label={`Feeling ${moment.emotion}`}
              >
                {emotionEmoji}
              </span>
            )}
            {moment.emotion && (
              <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
                {moment.emotion}
              </span>
            )}
          </div>
          <time className="text-xs text-muted-foreground" dateTime={moment.created_at}>
            {formatRelativeTime(moment.created_at)}
          </time>
        </div>
      </div>

      <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-card-foreground">
        {moment.content}
      </p>

      <div className="mt-3 flex items-center gap-4 border-t border-border pt-2">
        <LikeButton momentId={moment.id} initialLikes={moment.likes} />
        <CommentSection momentId={moment.id} initialComments={moment.comments} />
      </div>
    </article>
  );
}
