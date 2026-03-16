"use client";

import { useState } from "react";
import Link from "next/link";
import { useGatewayStatus, useGatewayActions } from "@/lib/hooks";

/**
 * Gateway Status Indicator
 * 
 * A small indicator showing Gateway online/offline status.
 * Clicking it navigates to the settings page.
 */
export function GatewayStatusIndicator() {
  const { data, loading } = useGatewayStatus({ pollInterval: 30000 });

  const isOnline = data?.status?.running ?? false;

  return (
    <Link
      href="/settings"
      className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#1d2b53]/50 cursor-pointer hover:bg-[#1d2b53]/70 transition-colors"
      title={isOnline ? "Gateway 运行中 - 点击查看详情" : "Gateway 离线 - 点击查看详情"}
    >
      <span
        className={`w-2 h-2 rounded-full ${
          loading
            ? "bg-yellow-400 animate-pulse"
            : isOnline
            ? "bg-green-400"
            : "bg-red-400"
        }`}
      />
      <span className="font-pixel text-[9px] text-[#c2c3c7] hidden sm:inline">
        {loading ? "..." : isOnline ? "在线" : "离线"}
      </span>
    </Link>
  );
}

/**
 * Gateway Control Panel
 * 
 * Full control panel for managing the OpenClaw Gateway.
 */
export function GatewayControlPanel() {
  const { data, loading, error, refresh } = useGatewayStatus({
    includeUpdates: true,
    includeLogs: false,
    pollInterval: 30000,
  });
  const { restart, update, loading: actionLoading } = useGatewayActions();

  const [showConfirm, setShowConfirm] = useState<"restart" | "update" | null>(null);
  const [actionResult, setActionResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleRestart = async () => {
    setShowConfirm(null);
    const result = await restart();
    setActionResult(result);
    if (result.success) {
      setTimeout(refresh, 3000); // Refresh after restart
    }
  };

  const handleUpdate = async () => {
    setShowConfirm(null);
    const result = await update();
    setActionResult(result);
    if (result.success) {
      setTimeout(refresh, 5000); // Refresh after update
    }
  };

  const status = data?.status;
  const updateStatus = data?.updateStatus;

  return (
    <div className="bg-[#1d2b53] rounded-lg border-2 border-[#5f574f] p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-pixel text-sm text-[#fff1e8] flex items-center gap-2">
          <span>🦞</span>
          <span>OpenClaw Gateway</span>
        </h2>
        <button
          onClick={refresh}
          disabled={loading}
          className="font-pixel text-[9px] text-[#83769c] hover:text-[#fff1e8] transition-colors disabled:opacity-50"
        >
          {loading ? "刷新中..." : "刷新"}
        </button>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-900/30 border border-red-500/50 rounded px-3 py-2">
          <p className="font-pixel text-[10px] text-red-400">{error}</p>
        </div>
      )}

      {/* Status Section */}
      {status && (
        <div className="space-y-3">
          {/* Running Status */}
          <div className="flex items-center gap-3">
            <span
              className={`w-3 h-3 rounded-full ${
                status.running ? "bg-green-400" : "bg-red-400"
              }`}
            />
            <span className="font-pixel text-xs text-[#fff1e8]">
              {status.running ? "运行中" : "已停止"}
            </span>
            {status.pid && (
              <span className="font-pixel text-[9px] text-[#83769c]">
                PID: {status.pid}
              </span>
            )}
          </div>

          {/* Version & Uptime */}
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <div>
              <span className="font-pixel text-[#83769c]">版本: </span>
              <span className="font-pixel text-[#fff1e8]">{status.version || "未知"}</span>
            </div>
            <div>
              <span className="font-pixel text-[#83769c]">状态: </span>
              <span className="font-pixel text-[#fff1e8]">{status.uptime || "未知"}</span>
            </div>
            <div>
              <span className="font-pixel text-[#83769c]">端口: </span>
              <span className="font-pixel text-[#fff1e8]">{status.port || "未知"}</span>
            </div>
            <div>
              <span className="font-pixel text-[#83769c]">绑定: </span>
              <span className="font-pixel text-[#fff1e8]">{status.bind || "未知"}</span>
            </div>
          </div>

          {/* Agent Count */}
          <div className="flex items-center gap-2">
            <span className="font-pixel text-[10px] text-[#83769c]">已连接 Agent:</span>
            <span className="font-pixel text-xs text-[#ffa300]">{status.agentCount}</span>
          </div>

          {/* Channels */}
          {status.channels.length > 0 && (
            <div className="space-y-1">
              <span className="font-pixel text-[10px] text-[#83769c]">频道状态:</span>
              <div className="flex flex-wrap gap-2">
                {status.channels.map((channel) => (
                  <div
                    key={channel.id}
                    className={`px-2 py-1 rounded text-[9px] font-pixel ${
                      channel.configured
                        ? "bg-green-900/30 text-green-400"
                        : "bg-gray-900/30 text-gray-400"
                    }`}
                  >
                    {channel.name}
                    {channel.accountCount > 1 && ` (${channel.accountCount})`}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Warnings */}
          {status.warnings.length > 0 && (
            <div className="bg-yellow-900/20 border border-yellow-500/30 rounded px-3 py-2">
              <p className="font-pixel text-[9px] text-yellow-400 mb-1">⚠️ 警告</p>
              {status.warnings.map((warning, i) => (
                <p key={i} className="font-pixel text-[9px] text-yellow-300/80">
                  {warning}
                </p>
              ))}
            </div>
          )}

          {/* Dashboard Link */}
          {status.dashboardUrl && (
            <a
              href={status.dashboardUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block font-pixel text-[10px] text-[#7ec8e3] hover:text-[#fff1e8] underline"
            >
              打开控制台 →
            </a>
          )}
        </div>
      )}

      {/* Update Status */}
      {updateStatus && (
        <div className="border-t border-[#5f574f] pt-3">
          <div className="flex items-center justify-between">
            <span className="font-pixel text-[10px] text-[#83769c]">
              当前版本: {updateStatus.currentVersion}
            </span>
            {updateStatus.updateAvailable && (
              <span className="font-pixel text-[9px] text-green-400">
                新版本可用: {updateStatus.latestVersion}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2 pt-2 border-t border-[#5f574f]">
        <button
          onClick={() => setShowConfirm("restart")}
          disabled={actionLoading || !status?.running}
          className="flex-1 font-pixel text-[10px] px-3 py-2 bg-[#ff6b6b]/20 text-[#ff6b6b] rounded border border-[#ff6b6b]/30 hover:bg-[#ff6b6b]/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          🔄 重启
        </button>
        <button
          onClick={() => setShowConfirm("update")}
          disabled={actionLoading || !updateStatus?.updateAvailable}
          className="flex-1 font-pixel text-[10px] px-3 py-2 bg-[#4ecdc4]/20 text-[#4ecdc4] rounded border border-[#4ecdc4]/30 hover:bg-[#4ecdc4]/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          ⬆️ 升级
        </button>
      </div>

      {/* Action Result */}
      {actionResult && (
        <div
          className={`rounded px-3 py-2 ${
            actionResult.success
              ? "bg-green-900/30 border border-green-500/50"
              : "bg-red-900/30 border border-red-500/50"
          }`}
        >
          <p
            className={`font-pixel text-[10px] ${
              actionResult.success ? "text-green-400" : "text-red-400"
            }`}
          >
            {actionResult.message}
          </p>
        </div>
      )}

      {/* Confirmation Dialog */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#1d2b53] border-2 border-[#5f574f] rounded-lg p-4 max-w-sm mx-4">
            <h3 className="font-pixel text-sm text-[#fff1e8] mb-3">
              {showConfirm === "restart" ? "确认重启?" : "确认升级?"}
            </h3>
            <p className="font-pixel text-[10px] text-[#c2c3c7] mb-4">
              {showConfirm === "restart"
                ? "重启 Gateway 会暂时中断所有 Agent 连接。确定要继续吗？"
                : "升级 OpenClaw 可能需要几分钟时间，期间服务会暂时不可用。确定要继续吗？"}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowConfirm(null)}
                className="flex-1 font-pixel text-[10px] px-3 py-2 bg-[#5f574f]/50 text-[#c2c3c7] rounded hover:bg-[#5f574f]/70 transition-colors"
              >
                取消
              </button>
              <button
                onClick={showConfirm === "restart" ? handleRestart : handleUpdate}
                className="flex-1 font-pixel text-[10px] px-3 py-2 bg-[#ff6b6b]/30 text-[#ff6b6b] rounded hover:bg-[#ff6b6b]/50 transition-colors"
              >
                确认
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
