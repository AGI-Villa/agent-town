/**
 * OpenClaw Gateway Integration
 *
 * Provides functions to interact with the OpenClaw Gateway CLI
 * for status monitoring, restart, and update operations.
 */

import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// Timeout for CLI commands (30 seconds)
const CLI_TIMEOUT = 30_000;

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

export interface OperationResult {
  success: boolean;
  message: string;
  error: string | null;
}

/**
 * Parse uptime from service status output.
 */
function parseUptime(statusOutput: string): { uptime: string | null; uptimeMs: number | null } {
  // Look for "Runtime: running (pid XXXX, state active, sub running, last exit 0, reason 0)"
  const runtimeMatch = statusOutput.match(/Runtime:\s*running\s*\(pid\s*(\d+)/);
  if (!runtimeMatch) {
    return { uptime: null, uptimeMs: null };
  }

  // Try to extract uptime from systemd status
  // This is a simplified approach - actual uptime would need systemd query
  return { uptime: "运行中", uptimeMs: null };
}

/**
 * Parse gateway status from CLI output.
 */
function parseGatewayStatus(statusOutput: string, healthOutput: string | null): GatewayStatus {
  const status: GatewayStatus = {
    running: false,
    pid: null,
    version: null,
    uptime: null,
    uptimeMs: null,
    port: null,
    bind: null,
    dashboardUrl: null,
    serviceFile: null,
    configPath: null,
    logPath: null,
    agentCount: 0,
    agents: [],
    channels: [],
    warnings: [],
    error: null,
  };

  // Parse running status
  const runtimeMatch = statusOutput.match(/Runtime:\s*running\s*\(pid\s*(\d+)/);
  if (runtimeMatch) {
    status.running = true;
    status.pid = parseInt(runtimeMatch[1], 10);
  }

  // Parse version from output
  const versionMatch = statusOutput.match(/OpenClaw\s+([\d.]+)/);
  if (versionMatch) {
    status.version = versionMatch[1];
  }

  // Parse port
  const portMatch = statusOutput.match(/port[=:]\s*(\d+)/i);
  if (portMatch) {
    status.port = parseInt(portMatch[1], 10);
  }

  // Parse bind mode
  const bindMatch = statusOutput.match(/bind[=:]\s*(\w+)/i);
  if (bindMatch) {
    status.bind = bindMatch[1];
  }

  // Parse dashboard URL
  const dashboardMatch = statusOutput.match(/Dashboard:\s*(https?:\/\/[^\s]+)/);
  if (dashboardMatch) {
    status.dashboardUrl = dashboardMatch[1];
  }

  // Parse service file
  const serviceMatch = statusOutput.match(/Service file:\s*([^\n]+)/);
  if (serviceMatch) {
    status.serviceFile = serviceMatch[1].trim();
  }

  // Parse config path
  const configMatch = statusOutput.match(/Config \(cli\):\s*([^\n]+)/);
  if (configMatch) {
    status.configPath = configMatch[1].trim();
  }

  // Parse log path
  const logMatch = statusOutput.match(/File logs:\s*([^\n]+)/);
  if (logMatch) {
    status.logPath = logMatch[1].trim();
  }

  // Parse warnings
  const warningMatches = statusOutput.matchAll(/[-•]\s*([^\n]+(?:channels\.[^\n]+|groupPolicy[^\n]+))/g);
  for (const match of warningMatches) {
    status.warnings.push(match[1].trim());
  }

  // Parse health data if available
  if (healthOutput) {
    try {
      // Extract JSON from health output (skip any prefix text)
      const jsonStart = healthOutput.indexOf("{");
      if (jsonStart >= 0) {
        const healthData = JSON.parse(healthOutput.slice(jsonStart));
        
        // Parse agents
        if (healthData.agents && Array.isArray(healthData.agents)) {
          status.agents = healthData.agents.map((agent: Record<string, unknown>) => ({
            id: agent.agentId as string,
            name: (agent.name as string) || (agent.agentId as string),
            isDefault: agent.isDefault as boolean || false,
            sessionCount: (agent.sessions as { count?: number })?.count || 0,
            lastActivity: null,
          }));
          status.agentCount = status.agents.length;
        }

        // Parse channels
        if (healthData.channels && typeof healthData.channels === "object") {
          const channelLabels = healthData.channelLabels as Record<string, string> || {};
          for (const [channelId, channelData] of Object.entries(healthData.channels)) {
            const data = channelData as Record<string, unknown>;
            const accounts = data.accounts as Record<string, unknown> || {};
            status.channels.push({
              id: channelId,
              name: channelLabels[channelId] || channelId,
              configured: data.configured as boolean || false,
              running: data.running as boolean || false,
              accountCount: Object.keys(accounts).length,
            });
          }
        }
      }
    } catch {
      // Health parsing failed, continue with basic status
    }
  }

  // Parse uptime
  const uptimeInfo = parseUptime(statusOutput);
  status.uptime = uptimeInfo.uptime;
  status.uptimeMs = uptimeInfo.uptimeMs;

  return status;
}

/**
 * Get OpenClaw Gateway status.
 */
export async function getGatewayStatus(): Promise<GatewayStatus> {
  try {
    // Run gateway status command
    const { stdout: statusOutput } = await execAsync("openclaw gateway status 2>&1", {
      timeout: CLI_TIMEOUT,
    });

    // Try to get health data
    let healthOutput: string | null = null;
    try {
      const { stdout } = await execAsync("openclaw gateway call health 2>&1", {
        timeout: CLI_TIMEOUT,
      });
      healthOutput = stdout;
    } catch {
      // Health call failed, continue without it
    }

    return parseGatewayStatus(statusOutput, healthOutput);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return {
      running: false,
      pid: null,
      version: null,
      uptime: null,
      uptimeMs: null,
      port: null,
      bind: null,
      dashboardUrl: null,
      serviceFile: null,
      configPath: null,
      logPath: null,
      agentCount: 0,
      agents: [],
      channels: [],
      warnings: [],
      error: `获取状态失败: ${error}`,
    };
  }
}

/**
 * Get OpenClaw version.
 */
export async function getVersion(): Promise<string | null> {
  try {
    const { stdout } = await execAsync("openclaw --version 2>&1", {
      timeout: CLI_TIMEOUT,
    });
    return stdout.trim();
  } catch {
    return null;
  }
}

/**
 * Check for updates.
 */
export async function checkForUpdates(): Promise<UpdateStatus> {
  try {
    const { stdout } = await execAsync("openclaw update status --json 2>&1", {
      timeout: CLI_TIMEOUT,
    });

    // Try to parse JSON output
    const jsonStart = stdout.indexOf("{");
    if (jsonStart >= 0) {
      const data = JSON.parse(stdout.slice(jsonStart));
      return {
        currentVersion: data.currentVersion || data.installed || "unknown",
        latestVersion: data.latestVersion || data.latest || null,
        updateAvailable: data.updateAvailable || data.hasUpdate || false,
        channel: data.channel || "stable",
        error: null,
      };
    }

    // Fallback: parse text output
    const currentMatch = stdout.match(/(?:current|installed)[:\s]+([\d.]+)/i);
    const latestMatch = stdout.match(/(?:latest|available)[:\s]+([\d.]+)/i);
    
    return {
      currentVersion: currentMatch?.[1] || "unknown",
      latestVersion: latestMatch?.[1] || null,
      updateAvailable: latestMatch ? latestMatch[1] !== currentMatch?.[1] : false,
      channel: "stable",
      error: null,
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return {
      currentVersion: "unknown",
      latestVersion: null,
      updateAvailable: false,
      channel: "stable",
      error: `检查更新失败: ${error}`,
    };
  }
}

/**
 * Restart the Gateway.
 * This is a potentially dangerous operation and should require confirmation.
 */
export async function restartGateway(): Promise<OperationResult> {
  try {
    const { stdout, stderr } = await execAsync("openclaw gateway restart 2>&1", {
      timeout: 60_000, // 60 seconds for restart
    });

    const output = stdout + stderr;
    
    // Check if restart was successful
    if (output.includes("error") || output.includes("failed")) {
      return {
        success: false,
        message: "重启失败",
        error: output,
      };
    }

    return {
      success: true,
      message: "Gateway 已重启",
      error: null,
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      message: "重启失败",
      error,
    };
  }
}

/**
 * Stop OpenClaw Gateway.
 */
export async function stopGateway(): Promise<OperationResult> {
  try {
    await execAsync("openclaw gateway stop 2>&1", { timeout: CLI_TIMEOUT });
    return { success: true, message: "Gateway 已停止", error: null };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { success: false, message: "停止失败", error };
  }
}

/**
 * Start OpenClaw Gateway.
 */
export async function startGateway(): Promise<OperationResult> {
  try {
    await execAsync("openclaw gateway start 2>&1", { timeout: CLI_TIMEOUT });
    return { success: true, message: "Gateway 已启动", error: null };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { success: false, message: "启动失败", error };
  }
}

/**
 * Update OpenClaw to the latest version.
 * This is a potentially dangerous operation and should require confirmation.
 */
export async function updateOpenClaw(): Promise<OperationResult> {
  try {
    const { stdout, stderr } = await execAsync("openclaw update --yes 2>&1", {
      timeout: 300_000, // 5 minutes for update
    });

    const output = stdout + stderr;
    
    // Check if update was successful
    if (output.includes("error") || output.includes("failed")) {
      return {
        success: false,
        message: "升级失败",
        error: output,
      };
    }

    return {
      success: true,
      message: "OpenClaw 已升级到最新版本",
      error: null,
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      message: "升级失败",
      error,
    };
  }
}

/**
 * Get recent log entries.
 */
export async function getRecentLogs(lines: number = 50): Promise<{ logs: string; error: string | null }> {
  try {
    // First get the log path from status
    const { stdout: statusOutput } = await execAsync("openclaw gateway status 2>&1", {
      timeout: CLI_TIMEOUT,
    });

    const logMatch = statusOutput.match(/File logs:\s*([^\n]+)/);
    if (!logMatch) {
      return { logs: "", error: "无法获取日志路径" };
    }

    const logPath = logMatch[1].trim();
    
    // Read last N lines from log file
    const { stdout } = await execAsync(`tail -n ${lines} "${logPath}" 2>&1`, {
      timeout: CLI_TIMEOUT,
    });

    return { logs: stdout, error: null };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { logs: "", error: `获取日志失败: ${error}` };
  }
}

/**
 * Read OpenClaw configuration (sanitized).
 */
export async function getConfig(): Promise<Record<string, unknown> | null> {
  try {
    const { readFile } = await import("fs/promises");
    const { resolve } = await import("path");
    const { homedir } = await import("os");
    
    const configPath = resolve(homedir(), ".openclaw", "openclaw.json");
    const content = await readFile(configPath, "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}
