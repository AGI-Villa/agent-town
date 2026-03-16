/**
 * OpenClaw Gateway Control
 *
 * Provides functions to interact with OpenClaw Gateway:
 * - Status monitoring (online, version, uptime, connected agents)
 * - Control operations (restart, update check, upgrade)
 * - Log access
 */

import { exec } from "child_process";
import { promisify } from "util";
import { readFile } from "fs/promises";
import { resolve } from "path";
import { homedir } from "os";

const execAsync = promisify(exec);

export interface GatewayStatus {
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

export interface UpdateInfo {
  currentVersion: string;
  latestVersion: string | null;
  updateAvailable: boolean;
  error: string | null;
}

export interface OperationResult {
  success: boolean;
  message: string;
  error?: string;
}

/**
 * Parse uptime from systemd timestamp to human-readable format
 */
function parseUptime(timestamp: string): { formatted: string; seconds: number } {
  const startTime = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - startTime.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);

  const days = Math.floor(diffSeconds / 86400);
  const hours = Math.floor((diffSeconds % 86400) / 3600);
  const minutes = Math.floor((diffSeconds % 3600) / 60);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes}m`);

  return { formatted: parts.join(" "), seconds: diffSeconds };
}

/**
 * Count connected agents by checking session files
 */
async function countConnectedAgents(): Promise<number> {
  try {
    const agentsDir = resolve(homedir(), ".openclaw", "agents");
    const { stdout } = await execAsync(
      `find "${agentsDir}" -name "*.jsonl" -mmin -5 2>/dev/null | wc -l`
    );
    return parseInt(stdout.trim(), 10) || 0;
  } catch {
    return 0;
  }
}

/**
 * Get OpenClaw Gateway status
 */
export async function getGatewayStatus(): Promise<GatewayStatus> {
  const status: GatewayStatus = {
    online: false,
    version: null,
    uptime: null,
    uptimeSeconds: null,
    pid: null,
    port: null,
    connectedAgents: 0,
    logFile: null,
    configPath: null,
    serviceEnabled: false,
    lastError: null,
  };

  try {
    // Get version
    const { stdout: versionOut } = await execAsync("openclaw --version 2>&1");
    status.version = versionOut.trim();
  } catch {
    // openclaw not installed
  }

  try {
    // Check systemd service status
    const { stdout: serviceStatus } = await execAsync(
      "systemctl --user show openclaw-gateway.service --property=ActiveState,SubState,MainPID,ActiveEnterTimestamp 2>&1"
    );

    const props: Record<string, string> = {};
    serviceStatus.split("\n").forEach((line) => {
      const [key, value] = line.split("=");
      if (key && value) props[key] = value;
    });

    status.online = props.ActiveState === "active" && props.SubState === "running";
    status.serviceEnabled = true;

    if (props.MainPID) {
      status.pid = parseInt(props.MainPID, 10) || null;
    }

    if (props.ActiveEnterTimestamp && status.online) {
      const { formatted, seconds } = parseUptime(props.ActiveEnterTimestamp);
      status.uptime = formatted;
      status.uptimeSeconds = seconds;
    }
  } catch {
    // systemd service not configured
  }

  try {
    // Get port from gateway status
    const { stdout: gatewayOut } = await execAsync(
      "openclaw gateway status 2>&1 | grep -E 'port=|OPENCLAW_GATEWAY_PORT'"
    );
    const portMatch = gatewayOut.match(/port[=:](\d+)/i);
    if (portMatch) {
      status.port = parseInt(portMatch[1], 10);
    }
  } catch {
    // ignore
  }

  // Get log file path
  const today = new Date().toISOString().split("T")[0];
  status.logFile = `/tmp/openclaw/openclaw-${today}.log`;

  // Get config path
  status.configPath = resolve(homedir(), ".openclaw", "openclaw.json");

  // Count connected agents
  status.connectedAgents = await countConnectedAgents();

  return status;
}

/**
 * Check for OpenClaw updates
 */
export async function checkForUpdates(): Promise<UpdateInfo> {
  const info: UpdateInfo = {
    currentVersion: "",
    latestVersion: null,
    updateAvailable: false,
    error: null,
  };

  try {
    const { stdout: versionOut } = await execAsync("openclaw --version 2>&1");
    info.currentVersion = versionOut.trim();
  } catch {
    info.error = "Failed to get current version";
    return info;
  }

  try {
    // Check npm registry for latest version
    const { stdout: npmOut } = await execAsync(
      "npm view openclaw version 2>&1",
      { timeout: 10000 }
    );
    info.latestVersion = npmOut.trim();
    info.updateAvailable = info.latestVersion !== info.currentVersion;
  } catch {
    info.error = "Failed to check for updates (network issue)";
  }

  return info;
}

/**
 * Restart OpenClaw Gateway
 */
export async function restartGateway(): Promise<OperationResult> {
  try {
    await execAsync("openclaw gateway restart 2>&1", { timeout: 30000 });
    return { success: true, message: "Gateway restarted successfully" };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { success: false, message: "Failed to restart gateway", error };
  }
}

/**
 * Stop OpenClaw Gateway
 */
export async function stopGateway(): Promise<OperationResult> {
  try {
    await execAsync("openclaw gateway stop 2>&1", { timeout: 30000 });
    return { success: true, message: "Gateway stopped successfully" };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { success: false, message: "Failed to stop gateway", error };
  }
}

/**
 * Start OpenClaw Gateway
 */
export async function startGateway(): Promise<OperationResult> {
  try {
    await execAsync("openclaw gateway start 2>&1", { timeout: 30000 });
    return { success: true, message: "Gateway started successfully" };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { success: false, message: "Failed to start gateway", error };
  }
}

/**
 * Upgrade OpenClaw to latest version
 */
export async function upgradeOpenClaw(): Promise<OperationResult> {
  try {
    // First stop the gateway
    await execAsync("openclaw gateway stop 2>&1", { timeout: 30000 });

    // Run update
    await execAsync("pnpm add -g openclaw@latest 2>&1", { timeout: 120000 });

    // Restart gateway
    await execAsync("openclaw gateway start 2>&1", { timeout: 30000 });

    // Get new version
    const { stdout: versionOut } = await execAsync("openclaw --version 2>&1");
    const newVersion = versionOut.trim();

    return {
      success: true,
      message: `Upgraded to version ${newVersion}`,
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { success: false, message: "Failed to upgrade OpenClaw", error };
  }
}

/**
 * Get recent log entries
 */
export async function getRecentLogs(lines: number = 50): Promise<string[]> {
  try {
    const today = new Date().toISOString().split("T")[0];
    const logFile = `/tmp/openclaw/openclaw-${today}.log`;
    const { stdout } = await execAsync(`tail -n ${lines} "${logFile}" 2>&1`);
    return stdout.split("\n").filter((line) => line.trim());
  } catch {
    return [];
  }
}

/**
 * Get error logs (filtered)
 */
export async function getErrorLogs(lines: number = 20): Promise<string[]> {
  try {
    const today = new Date().toISOString().split("T")[0];
    const logFile = `/tmp/openclaw/openclaw-${today}.log`;
    const { stdout } = await execAsync(
      `grep -i "error\\|warn\\|fail" "${logFile}" 2>/dev/null | tail -n ${lines}`
    );
    return stdout.split("\n").filter((line) => line.trim());
  } catch {
    return [];
  }
}

/**
 * Read OpenClaw configuration
 */
export async function getConfig(): Promise<Record<string, unknown> | null> {
  try {
    const configPath = resolve(homedir(), ".openclaw", "openclaw.json");
    const content = await readFile(configPath, "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}
