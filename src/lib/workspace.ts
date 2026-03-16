/**
 * Multi-workspace support for Agent Town.
 *
 * A workspace represents an isolated team of agents with:
 * - Separate agent configurations
 * - Isolated event streams
 * - Shareable URLs
 */

export interface Workspace {
  id: string;
  name: string;
  description?: string;
  agentIds: string[];
  createdAt: string;
  isDefault?: boolean;
}

export interface WorkspaceConfig {
  workspaces: Workspace[];
  defaultWorkspaceId: string;
}

// Default workspace for backward compatibility
const DEFAULT_WORKSPACE: Workspace = {
  id: "default",
  name: "Default Team",
  description: "All agents in one workspace",
  agentIds: [],
  createdAt: new Date().toISOString(),
  isDefault: true,
};

// In-memory cache for workspaces (server-side)
let workspaceCache: Map<string, Workspace> | null = null;
let configCache: WorkspaceConfig | null = null;

/**
 * Get workspace configuration from environment or defaults.
 */
export function getWorkspaceConfig(): WorkspaceConfig {
  if (configCache) return configCache;

  // Try to load from environment variable (JSON string)
  const envConfig = process.env.WORKSPACE_CONFIG;
  if (envConfig) {
    try {
      configCache = JSON.parse(envConfig) as WorkspaceConfig;
      return configCache;
    } catch {
      console.warn("[workspace] Failed to parse WORKSPACE_CONFIG, using defaults");
    }
  }

  // Default configuration
  configCache = {
    workspaces: [DEFAULT_WORKSPACE],
    defaultWorkspaceId: "default",
  };

  return configCache;
}

/**
 * Get all workspaces.
 */
export function getAllWorkspaces(): Workspace[] {
  return getWorkspaceConfig().workspaces;
}

/**
 * Get a workspace by ID.
 */
export function getWorkspace(workspaceId: string): Workspace | null {
  if (!workspaceCache) {
    workspaceCache = new Map();
    for (const ws of getAllWorkspaces()) {
      workspaceCache.set(ws.id, ws);
    }
  }
  return workspaceCache.get(workspaceId) ?? null;
}

/**
 * Get the default workspace.
 */
export function getDefaultWorkspace(): Workspace {
  const config = getWorkspaceConfig();
  return getWorkspace(config.defaultWorkspaceId) ?? DEFAULT_WORKSPACE;
}

/**
 * Check if an agent belongs to a workspace.
 * If workspace has no agentIds defined, all agents belong to it.
 */
export function isAgentInWorkspace(agentId: string, workspaceId: string): boolean {
  const workspace = getWorkspace(workspaceId);
  if (!workspace) return false;

  // Empty agentIds means all agents belong to this workspace
  if (workspace.agentIds.length === 0) return true;

  return workspace.agentIds.includes(agentId);
}

/**
 * Get agents for a specific workspace.
 */
export function getWorkspaceAgentIds(workspaceId: string): string[] | null {
  const workspace = getWorkspace(workspaceId);
  if (!workspace) return null;

  // Empty array means "all agents"
  return workspace.agentIds;
}

/**
 * Generate a shareable URL for a workspace.
 */
export function getWorkspaceUrl(workspaceId: string, baseUrl: string): string {
  if (workspaceId === "default") {
    return baseUrl;
  }
  return `${baseUrl}?workspace=${encodeURIComponent(workspaceId)}`;
}

/**
 * Parse workspace ID from URL search params.
 */
export function parseWorkspaceFromUrl(searchParams: URLSearchParams): string {
  return searchParams.get("workspace") ?? "default";
}

/**
 * Invalidate workspace cache (for dynamic updates).
 */
export function invalidateWorkspaceCache(): void {
  workspaceCache = null;
  configCache = null;
}
