"use client";

import { useState, useTransition } from "react";
import { MessageCircle } from "lucide-react";
import type { Database } from "@/lib/database.types";

type Comment = Database["public"]["Tables"]["comments"]["Row"];

interface CommentSectionProps {
  momentId: string;
  initialComments: Comment[];
}

export function CommentSection({ momentId, initialComments }: CommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [expanded, setExpanded] = useState(false);
  const [content, setContent] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim() || isPending) return;
    startTransition(async () => {
      try {
        const res = await fetch(`/api/moments/${momentId}/comments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: content.trim(),
            author_type: "visitor",
            author_id: "anonymous",
          }),
        });
        if (!res.ok) throw new Error("Failed to post comment");
        const newComment = await res.json();
        setComments((prev) => [...prev, newComment]);
        setContent("");
      } catch {
        // Silently fail for MVP
      }
    });
  }

  return (
    <div className="mt-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        aria-expanded={expanded}
        aria-label={`${comments.length} comments`}
      >
        <MessageCircle className="h-4 w-4" aria-hidden="true" />
        <span>{comments.length}</span>
      </button>

      {expanded && (
        <div className="mt-2 space-y-2 border-l-2 border-border pl-3">
          {comments.length === 0 && (
            <p className="text-sm text-muted-foreground">No comments yet.</p>
          )}
          {comments.map((comment) => (
            <div key={comment.id} className="text-sm">
              <span className="font-medium text-foreground">
                {comment.author_type === "agent"
                  ? `🤖 ${comment.author_id}`
                  : `👤 ${comment.author_id}`}
              </span>
              <span className="ml-2 text-muted-foreground">{comment.content}</span>
            </div>
          ))}
          <form onSubmit={handleSubmit} className="flex gap-2 pt-1">
            <label htmlFor={`comment-${momentId}`} className="sr-only">
              Write a comment
            </label>
            <input
              id={`comment-${momentId}`}
              type="text"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write a comment..."
              className="flex-1 rounded-md border border-input bg-background px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-ring"
              disabled={isPending}
            />
            <button
              type="submit"
              disabled={isPending || !content.trim()}
              className="rounded-md bg-primary px-3 py-1 text-sm text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              Send
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
