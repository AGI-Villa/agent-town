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
  frustrated: "😤",
  amused: "😄",
  focused: "🎯",
  surprised: "😮",
};

const AGENT_NAMES: Record<string, string> = {
  secretary: "刘亦菲",
  cto: "扫地僧",
  "dev-lead": "韦小宝",
  cpo: "乔布斯",
  uiux: "高圆圆",
  cmo: "达达里奥",
  culture: "李子柒",
  hardware: "马斯克",
  advisor: "巴菲特",
};

const AGENT_ROLES: Record<string, string> = {
  secretary: "首席秘书",
  cto: "首席技术官",
  "dev-lead": "开发主管",
  cpo: "首席产品官",
  uiux: "UI/UX 设计师",
  cmo: "首席营销官",
  culture: "文化官",
  hardware: "硬件总监",
  advisor: "战略顾问",
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
              {AGENT_NAMES[moment.agent_id] ?? moment.agent_id}
            </span>
            {AGENT_ROLES[moment.agent_id] && (
              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                {AGENT_ROLES[moment.agent_id]}
              </span>
            )}
            {emotionEmoji && (
              <span
                className="shrink-0 text-sm"
                role="img"
                aria-label={`Feeling ${moment.emotion}`}
              >
                {emotionEmoji}
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
