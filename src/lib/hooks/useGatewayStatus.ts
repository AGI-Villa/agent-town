"use client";

import { useState, useEffect, useCallback } from "react";

export interface GatewayStatus {
  running: boolean;
  pid: number | null;
  version: string | null;
  uptime: string | null;
  uptimeMs: number | null;
  port: number | null;
  bind: string | null;
  dashboardUrl: string | null;
  serviceFile: string | null;
  configPath: string | null;
  logPath: string | null;
  agentCount: number;
  agents: GatewayAgent[];
  channels: GatewayChannel[];
  warnings: string[];
  error: string | null;
}

export interface GatewayAgent {
  id: string;
  name: string;
  isDefault: boolean;
  sessionCount: number;
  lastActivity: string | null;
}

export interface GatewayChannel {
  id: string;
  name: string;
  configured: boolean;
  running: boolean;
  accountCount: number;
}

export interface UpdateStatus {
  currentVersion: string;
  latestVersion: string | null;
  updateAvailable: boolean;
  channel: string;
  error: string | null;
}

export interface GatewayData {
  status: GatewayStatus | null;
  updateStatus: UpdateStatus | null;
  logs: { logs: string; error: string | null } | null;
  timestamp: string | null;
}

interface UseGatewayStatusOptions {
  includeUpdates?: boolean;
  includeLogs?: boolean;
  logLines?: number;
  pollInterval?: number; // in milliseconds, 0 to disable
}

export function useGatewayStatus(options: UseGatewayStatusOptions = {}) {
  const {
    includeUpdates = false,
    includeLogs = false,
    logLines = 50,
    pollInterval = 30000, // 30 seconds default
  } = options;

  const [data, setData] = useState<GatewayData>({
    status: null,
    updateStatus: null,
    logs: null,
    timestamp: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (includeUpdates) params.set("updates", "true");
      if (includeLogs) {
        params.set("logs", "true");
        params.set("logLines", String(logLines));
      }

      const response = await fetch(`/api/gateway?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "获取状态失败");
    } finally {
      setLoading(false);
    }
  }, [includeUpdates, includeLogs, logLines]);

  useEffect(() => {
    fetchStatus();

    if (pollInterval > 0) {
      const interval = setInterval(fetchStatus, pollInterval);
      return () => clearInterval(interval);
    }
  }, [fetchStatus, pollInterval]);

  const refresh = useCallback(() => {
    setLoading(true);
    return fetchStatus();
  }, [fetchStatus]);

  return { data, loading, error, refresh };
}

interface ActionResult {
  success: boolean;
  message: string;
  error: string | null;
}

export function useGatewayActions() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const performAction = useCallback(async (action: "restart" | "update"): Promise<ActionResult> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/gateway/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          confirmToken: "CONFIRM_GATEWAY_ACTION",
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      return data.result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "操作失败";
      setError(message);
      return { success: false, message: "操作失败", error: message };
    } finally {
      setLoading(false);
    }
  }, []);

  const restart = useCallback(() => performAction("restart"), [performAction]);
  const update = useCallback(() => performAction("update"), [performAction]);

  return { restart, update, loading, error };
}
