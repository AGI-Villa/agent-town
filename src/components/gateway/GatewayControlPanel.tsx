"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Power, PowerOff, ArrowUpCircle, AlertTriangle, CheckCircle, XCircle, Loader2 } from "lucide-react";

interface GatewayStatus {
  online: boolean;
  version: string | null;
  uptime: string | null;
  uptimeSeconds: number | null;
  pid: number | null;
  port: number | null;
  connectedAgents: number;
  logFile: string | null;
  configPath: string | null;
  serviceEnabled: boolean;
  lastError: string | null;
}

interface UpdateInfo {
  currentVersion: string;
  latestVersion: string | null;
  updateAvailable: boolean;
  error: string | null;
}

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

function ConfirmDialog({ isOpen, title, message, confirmText, onConfirm, onCancel, isLoading }: ConfirmDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="mx-4 w-full max-w-sm rounded-xl border-4 border-[#ff004d] bg-[#1d2b53] p-6">
        <div className="mb-4 flex items-center gap-2">
          <AlertTriangle className="h-6 w-6 text-[#ff004d]" />
          <h3 className="font-pixel text-sm text-[#ff004d]">{title}</h3>
        </div>
        <p className="mb-6 font-pixel text-[10px] text-[#c2c3c7] leading-relaxed">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 rounded-lg border-2 border-[#5f574f] bg-[#1d2b53] px-4 py-2 font-pixel text-[10px] text-[#c2c3c7] transition-colors hover:border-[#83769c] disabled:opacity-50"
          >
            CANCEL
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 rounded-lg border-2 border-[#ff004d] bg-[#ff004d]/20 px-4 py-2 font-pixel text-[10px] text-[#ff004d] transition-colors hover:bg-[#ff004d]/30 disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export function GatewayControlPanel() {
  const [status, setStatus] = useState<GatewayStatus | null>(null);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showLogs, setShowLogs] = useState(false);
  const [logType, setLogType] = useState<"recent" | "errors">("recent");
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    action: string;
    title: string;
    message: string;
  } | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/gateway/status");
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch (err) {
      console.error("Failed to fetch status:", err);
    }
  }, []);

  const fetchUpdateInfo = useCallback(async () => {
    try {
      const res = await fetch("/api/gateway/updates");
      if (res.ok) {
        const data = await res.json();
        setUpdateInfo(data);
      }
    } catch (err) {
      console.error("Failed to fetch update info:", err);
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch(`/api/gateway/logs?type=${logType}&lines=50`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch (err) {
      console.error("Failed to fetch logs:", err);
    }
  }, [logType]);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([fetchStatus(), fetchUpdateInfo()]);
      setIsLoading(false);
    };
    loadData();

    // Auto-refresh status every 30 seconds
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, [fetchStatus, fetchUpdateInfo]);

  useEffect(() => {
    if (showLogs) {
      fetchLogs();
    }
  }, [showLogs, logType, fetchLogs]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const executeAction = async (action: string, requireConfirm = false) => {
    if (requireConfirm) {
      setConfirmDialog({
        isOpen: true,
        action,
        title: action === "upgrade" ? "UPGRADE OPENCLAW" : action === "stop" ? "STOP GATEWAY" : "CONFIRM ACTION",
        message: action === "upgrade"
          ? "This will stop the gateway, upgrade OpenClaw to the latest version, and restart. All active sessions may be interrupted."
          : action === "stop"
          ? "This will stop the OpenClaw gateway. All agent connections will be terminated."
          : `Are you sure you want to ${action} the gateway?`,
      });
      return;
    }

    setActionLoading(action);
    try {
      const res = await fetch("/api/gateway/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          confirmToken: ["upgrade", "stop"].includes(action) ? "CONFIRM" : undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setToast({ type: "success", message: data.message });
        // Refresh status after action
        setTimeout(fetchStatus, 2000);
        if (action === "upgrade") {
          setTimeout(fetchUpdateInfo, 3000);
        }
      } else {
        setToast({ type: "error", message: data.error || data.message });
      }
    } catch {
      setToast({ type: "error", message: "Failed to execute action" });
    } finally {
      setActionLoading(null);
      setConfirmDialog(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-[#ffa300]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toast notification */}
      {toast && (
        <div
          className={`fixed right-4 top-4 z-50 flex items-center gap-2 rounded-lg border-2 px-4 py-3 ${
            toast.type === "success"
              ? "border-[#00e436] bg-[#00e436]/20 text-[#00e436]"
              : "border-[#ff004d] bg-[#ff004d]/20 text-[#ff004d]"
          }`}
        >
          {toast.type === "success" ? (
            <CheckCircle className="h-4 w-4" />
          ) : (
            <XCircle className="h-4 w-4" />
          )}
          <span className="font-pixel text-[10px]">{toast.message}</span>
        </div>
      )}

      {/* Confirm dialog */}
      {confirmDialog && (
        <ConfirmDialog
          isOpen={confirmDialog.isOpen}
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmText={confirmDialog.action.toUpperCase()}
          onConfirm={() => executeAction(confirmDialog.action)}
          onCancel={() => setConfirmDialog(null)}
          isLoading={actionLoading === confirmDialog.action}
        />
      )}

      {/* Status Card */}
      <div className="rounded-xl border-4 border-[#5f574f] bg-[#1d2b53] p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-pixel text-sm text-[#fff1e8]">GATEWAY STATUS</h2>
          <button
            onClick={() => fetchStatus()}
            className="rounded-lg p-2 text-[#83769c] transition-colors hover:bg-white/5 hover:text-[#fff1e8]"
            title="Refresh status"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Online Status */}
          <div className="rounded-lg border-2 border-[#5f574f] bg-black/20 p-3">
            <div className="mb-1 font-pixel text-[9px] text-[#83769c]">STATUS</div>
            <div className="flex items-center gap-2">
              <div
                className={`h-3 w-3 rounded-full ${
                  status?.online ? "bg-[#00e436] animate-pulse" : "bg-[#ff004d]"
                }`}
              />
              <span
                className={`font-pixel text-xs ${
                  status?.online ? "text-[#00e436]" : "text-[#ff004d]"
                }`}
              >
                {status?.online ? "ONLINE" : "OFFLINE"}
              </span>
            </div>
          </div>

          {/* Version */}
          <div className="rounded-lg border-2 border-[#5f574f] bg-black/20 p-3">
            <div className="mb-1 font-pixel text-[9px] text-[#83769c]">VERSION</div>
            <div className="flex items-center gap-2">
              <span className="font-pixel text-xs text-[#fff1e8]">
                {status?.version || "N/A"}
              </span>
              {updateInfo?.updateAvailable && (
                <span className="rounded bg-[#ffa300]/20 px-1.5 py-0.5 font-pixel text-[8px] text-[#ffa300]">
                  UPDATE
                </span>
              )}
            </div>
          </div>

          {/* Uptime */}
          <div className="rounded-lg border-2 border-[#5f574f] bg-black/20 p-3">
            <div className="mb-1 font-pixel text-[9px] text-[#83769c]">UPTIME</div>
            <span className="font-pixel text-xs text-[#fff1e8]">
              {status?.uptime || "N/A"}
            </span>
          </div>

          {/* Connected Agents */}
          <div className="rounded-lg border-2 border-[#5f574f] bg-black/20 p-3">
            <div className="mb-1 font-pixel text-[9px] text-[#83769c]">AGENTS</div>
            <span className="font-pixel text-xs text-[#fff1e8]">
              {status?.connectedAgents ?? 0} active
            </span>
          </div>
        </div>

        {/* Additional Info */}
        {status?.port && (
          <div className="mt-4 flex flex-wrap gap-4 text-[#83769c]">
            <span className="font-pixel text-[9px]">
              Port: <span className="text-[#c2c3c7]">{status.port}</span>
            </span>
            {status.pid && (
              <span className="font-pixel text-[9px]">
                PID: <span className="text-[#c2c3c7]">{status.pid}</span>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Control Actions */}
      <div className="rounded-xl border-4 border-[#5f574f] bg-[#1d2b53] p-4 sm:p-6">
        <h2 className="mb-4 font-pixel text-sm text-[#fff1e8]">CONTROLS</h2>
        <div className="flex flex-wrap gap-3">
          {status?.online ? (
            <>
              <button
                onClick={() => executeAction("restart")}
                disabled={!!actionLoading}
                className="flex items-center gap-2 rounded-lg border-2 border-[#ffa300] bg-[#ffa300]/20 px-4 py-2 font-pixel text-[10px] text-[#ffa300] transition-colors hover:bg-[#ffa300]/30 disabled:opacity-50"
              >
                {actionLoading === "restart" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                RESTART
              </button>
              <button
                onClick={() => executeAction("stop", true)}
                disabled={!!actionLoading}
                className="flex items-center gap-2 rounded-lg border-2 border-[#ff004d] bg-[#ff004d]/20 px-4 py-2 font-pixel text-[10px] text-[#ff004d] transition-colors hover:bg-[#ff004d]/30 disabled:opacity-50"
              >
                {actionLoading === "stop" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <PowerOff className="h-4 w-4" />
                )}
                STOP
              </button>
            </>
          ) : (
            <button
              onClick={() => executeAction("start")}
              disabled={!!actionLoading}
              className="flex items-center gap-2 rounded-lg border-2 border-[#00e436] bg-[#00e436]/20 px-4 py-2 font-pixel text-[10px] text-[#00e436] transition-colors hover:bg-[#00e436]/30 disabled:opacity-50"
            >
              {actionLoading === "start" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Power className="h-4 w-4" />
              )}
              START
            </button>
          )}

          {updateInfo?.updateAvailable && (
            <button
              onClick={() => executeAction("upgrade", true)}
              disabled={!!actionLoading}
              className="flex items-center gap-2 rounded-lg border-2 border-[#29adff] bg-[#29adff]/20 px-4 py-2 font-pixel text-[10px] text-[#29adff] transition-colors hover:bg-[#29adff]/30 disabled:opacity-50"
            >
              {actionLoading === "upgrade" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowUpCircle className="h-4 w-4" />
              )}
              UPGRADE TO {updateInfo.latestVersion}
            </button>
          )}
        </div>

        {updateInfo?.error && (
          <p className="mt-3 font-pixel text-[9px] text-[#ff004d]">
            ⚠️ {updateInfo.error}
          </p>
        )}
      </div>

      {/* Logs Section */}
      <div className="rounded-xl border-4 border-[#5f574f] bg-[#1d2b53] p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-pixel text-sm text-[#fff1e8]">LOGS</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setLogType("recent")}
              className={`rounded-lg px-3 py-1 font-pixel text-[9px] transition-colors ${
                logType === "recent"
                  ? "bg-[#ffa300]/20 text-[#ffa300]"
                  : "text-[#83769c] hover:text-[#c2c3c7]"
              }`}
            >
              RECENT
            </button>
            <button
              onClick={() => setLogType("errors")}
              className={`rounded-lg px-3 py-1 font-pixel text-[9px] transition-colors ${
                logType === "errors"
                  ? "bg-[#ff004d]/20 text-[#ff004d]"
                  : "text-[#83769c] hover:text-[#c2c3c7]"
              }`}
            >
              ERRORS
            </button>
            <button
              onClick={() => setShowLogs(!showLogs)}
              className="rounded-lg px-3 py-1 font-pixel text-[9px] text-[#83769c] transition-colors hover:text-[#c2c3c7]"
            >
              {showLogs ? "HIDE" : "SHOW"}
            </button>
          </div>
        </div>

        {showLogs && (
          <div className="max-h-64 overflow-auto rounded-lg border-2 border-[#5f574f] bg-black/40 p-3">
            {logs.length > 0 ? (
              <pre className="font-mono text-[9px] text-[#c2c3c7] leading-relaxed">
                {logs.join("\n")}
              </pre>
            ) : (
              <p className="font-pixel text-[9px] text-[#83769c]">No logs available</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
