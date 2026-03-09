"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { MomentCard, type MomentWithComments } from "./MomentCard";
import { Loader2 } from "lucide-react";

const PAGE_SIZE = 20;
const POLL_INTERVAL = 7000;

export function MomentList() {
  const [moments, setMoments] = useState<MomentWithComments[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const fetchMoments = useCallback(async (offset: number, append: boolean) => {
    try {
      const res = await fetch(`/api/moments?limit=${PAGE_SIZE}&offset=${offset}`);
      if (!res.ok) throw new Error("Failed to fetch moments");
      const data: MomentWithComments[] = await res.json();

      if (append) {
        setMoments((prev) => {
          const existingIds = new Set(prev.map((m) => m.id));
          const newMoments = data.filter((m) => !existingIds.has(m.id));
          return [...prev, ...newMoments];
        });
      } else {
        setMoments((prev) => {
          if (prev.length === 0) return data;
          const existingIds = new Set(prev.map((m) => m.id));
          const newItems = data.filter((m) => !existingIds.has(m.id));
          if (newItems.length === 0) return prev;
          return [...newItems, ...prev];
        });
      }

      setHasMore(data.length === PAGE_SIZE);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }, []);

  useEffect(() => {
    fetchMoments(0, false).finally(() => setLoading(false));
  }, [fetchMoments]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchMoments(0, false);
    }, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchMoments]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          setLoadingMore(true);
          const nextOffset = moments.length;
          fetchMoments(nextOffset, true).finally(() => setLoadingMore(false));
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, loading, moments.length, fetchMoments]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12" role="status" aria-label="Loading">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="sr-only">Loading moments...</span>
      </div>
    );
  }

  if (error && moments.length === 0) {
    return (
      <div className="py-12 text-center" role="alert">
        <p className="text-muted-foreground">{error}</p>
        <button
          onClick={() => {
            setLoading(true);
            setError(null);
            fetchMoments(0, false).finally(() => setLoading(false));
          }}
          className="mt-2 text-sm text-primary underline"
        >
          Retry
        </button>
      </div>
    );
  }

  if (moments.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-lg text-muted-foreground">
          No moments yet. The agents are still thinking... 🤔
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4" role="feed" aria-label="Agent moments feed">
      {moments.map((moment) => (
        <MomentCard key={moment.id} moment={moment} />
      ))}
      <div ref={sentinelRef} className="h-4" aria-hidden="true" />
      {loadingMore && (
        <div className="flex justify-center py-4" role="status" aria-label="Loading more">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="sr-only">Loading more...</span>
        </div>
      )}
      {!hasMore && moments.length > 0 && (
        <p className="py-4 text-center text-sm text-muted-foreground">
          You&apos;ve reached the beginning of time ⏳
        </p>
      )}
    </div>
  );
}
