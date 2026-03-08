"use client";

import { useState, useEffect, useCallback } from "react";

interface WatcherStatus {
  running: boolean;
  watchPath: string;
  trackedFiles: number;
  totalEventsProcessed: number;
  startedAt: string | null;
  errors: string[];
}

export function WatcherControl() {
  const [status, setStatus] = useState<WatcherStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/watcher");
      if (!res.ok) throw new Error("Failed to fetch watcher status");
      const data: WatcherStatus = await res.json();
      setStatus(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const handleAction = async (action: "start" | "stop") => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/watcher", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Action failed");
      setStatus(data.status);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const isRunning = status?.running ?? false;

  return (
    <div className="mb-6 rounded-none border-2 border-[#5f574f] bg-[#1d2b53]/60 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Status indicator */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full ${
                isRunning ? "bg-[#00e436] animate-pulse" : "bg-[#83769c]"
              }`}
              aria-hidden="true"
            />
            <span className="font-pixel text-[10px] text-[#fff1e8]">
              WATCHER: {isRunning ? "RUNNING" : "STOPPED"}
            </span>
          </div>

          {status && isRunning && (
            <>
              <span className="font-pixel text-[10px] text-[#c2c3c7]">
                FILES: {status.trackedFiles}
              </span>
              <span className="font-pixel text-[10px] text-[#c2c3c7]">
                EVENTS: {status.totalEventsProcessed}
              </span>
            </>
          )}
        </div>

        {/* Control button */}
        <button
          onClick={() => handleAction(isRunning ? "stop" : "start")}
          disabled={loading}
          className={`rounded-none border-2 px-4 py-1.5 font-pixel text-[10px] transition-colors disabled:opacity-50 ${
            isRunning
              ? "border-[#ff004d] text-[#ff004d] hover:bg-[#ff004d] hover:text-[#000000]"
              : "border-[#00e436] text-[#00e436] hover:bg-[#00e436] hover:text-[#000000]"
          }`}
          aria-label={isRunning ? "Stop watcher" : "Start watcher"}
        >
          {loading ? "..." : isRunning ? "STOP WATCHER" : "START WATCHER"}
        </button>
      </div>

      {/* Error display */}
      {error && (
        <p className="mt-2 font-pixel text-[10px] text-[#ff004d]" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
