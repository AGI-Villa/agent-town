/**
 * OpenClaw Auto-Discovery
 *
 * Reads ~/.openclaw/openclaw.json to discover all registered agents,
 * then optionally reads each agent's IDENTITY.md for personality data.
 *
 * This is the primary source of truth — agents.json is only a fallback
 * for users who don't run OpenClaw or want to override display names.
 */

import { readFile, readdir, access } from "fs/promises";
import { resolve } from "path";
import { homedir } from "os";

function expandTilde(p: string): string {
  return p.startsWith("~") ? resolve(homedir(), p.slice(1).replace(/^\//, "")) : resolve(p);
}

export interface DiscoveredAgent {
  id: string;
  name: string;
  role: string | null;
  personality: string | null;
  workspace: string | null;
  hasSessionLogs: boolean;
}

interface OpenClawAgentEntry {
  id: string;
  name?: string;
  workspace?: string;
  agentDir?: string;
}

interface OpenClawConfig {
  agents?: {
    list?: OpenClawAgentEntry[];
  };
}

const OPENCLAW_HOME = process.env.OPENCLAW_HOME
  ? expandTilde(process.env.OPENCLAW_HOME)
  : resolve(homedir(), ".openclaw");

const CONFIG_PATH = resolve(OPENCLAW_HOME, "openclaw.json");
const AGENTS_DIR = resolve(OPENCLAW_HOME, "agents");

let cachedAgents: Map<string, DiscoveredAgent> | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60_000;

/**
 * Parse the first heading and key sections from IDENTITY.md
 * to extract role and personality.
 */
function parseIdentityMd(content: string): { role: string | null; personality: string | null } {
  const lines = content.split("\n");
  let role: string | null = null;
  let personality: string | null = null;

  const firstHeading = lines.find((l) => l.startsWith("# "));
  if (firstHeading) {
    // "# 扫地僧 · CTO（首席技术官）" → extract role part
    const match = firstHeading.match(/[·\-—]\s*(.+)/);
    if (match) {
      role = match[1].replace(/[（(].*[）)]/, "").trim();
    }
  }

  // Look for personality in "说话风格", "Vibe", or "性格" sections
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/vibe|性格|说话风格|说话方式/i.test(line)) {
      const nextLines: string[] = [];
      for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
        const nl = lines[j].replace(/^[-*]\s*/, "").trim();
        if (nl && !nl.startsWith("#")) nextLines.push(nl);
        else if (nl.startsWith("#")) break;
      }
      if (nextLines.length > 0) {
        personality = nextLines.slice(0, 3).join("；");
        break;
      }
    }
  }

  // Fallback: look for "**Vibe:**" inline pattern
  if (!personality) {
    const vibeLine = lines.find((l) => /\*\*Vibe[：:]\*\*/i.test(l));
    if (vibeLine) {
      personality = vibeLine.replace(/.*\*\*Vibe[：:]\*\*\s*/i, "").trim();
    }
  }

  return { role, personality };
}

/**
 * Check if an agent has session log files.
 */
async function hasSessionLogs(agentId: string): Promise<boolean> {
  const sessionsDir = resolve(AGENTS_DIR, agentId, "sessions");
  try {
    const files = await readdir(sessionsDir);
    return files.some((f) => f.endsWith(".jsonl"));
  } catch {
    return false;
  }
}

/**
 * Discover all agents from OpenClaw configuration.
 * Results are cached for CACHE_TTL_MS to avoid re-reading files on every request.
 */
export async function discoverAgents(): Promise<Map<string, DiscoveredAgent>> {
  const now = Date.now();
  if (cachedAgents && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedAgents;
  }

  const agents = new Map<string, DiscoveredAgent>();

  try {
    await access(CONFIG_PATH);
  } catch {
    console.warn(`[discovery] OpenClaw config not found at ${CONFIG_PATH}, using fallback`);
    cachedAgents = agents;
    cacheTimestamp = now;
    return agents;
  }

  try {
    const raw = await readFile(CONFIG_PATH, "utf-8");
    const config: OpenClawConfig = JSON.parse(raw);
    const agentList = config.agents?.list ?? [];

    await Promise.all(
      agentList.map(async (entry) => {
        const { id } = entry;
        if (!id) return;

        let role: string | null = null;
        let personality: string | null = null;

        // Try reading IDENTITY.md from workspace
        const workspaceDir =
          entry.workspace ?? resolve(OPENCLAW_HOME, `workspace-${id}`);
        try {
          const identityPath = resolve(workspaceDir, "IDENTITY.md");
          const content = await readFile(identityPath, "utf-8");
          const parsed = parseIdentityMd(content);
          role = parsed.role;
          personality = parsed.personality;
        } catch {
          // IDENTITY.md doesn't exist, that's fine
        }

        const hasLogs = await hasSessionLogs(id);

        agents.set(id, {
          id,
          name: entry.name ?? id,
          role,
          personality,
          workspace: entry.workspace ?? null,
          hasSessionLogs: hasLogs,
        });
      })
    );

    console.log(
      `[discovery] Found ${agents.size} agents from OpenClaw config (${[...agents.values()].filter((a) => a.hasSessionLogs).length} with session logs)`
    );
  } catch (err) {
    console.error(
      "[discovery] Failed to read OpenClaw config:",
      err instanceof Error ? err.message : err
    );
  }

  cachedAgents = agents;
  cacheTimestamp = now;
  return agents;
}

/**
 * Get the OpenClaw home directory.
 */
export function getOpenClawHome(): string {
  return OPENCLAW_HOME;
}

/**
 * Get the agents directory (for watcher).
 */
export function getAgentsDir(): string {
  return AGENTS_DIR;
}

/**
 * Force refresh the agent cache (e.g., after config changes).
 */
export function invalidateCache(): void {
  cachedAgents = null;
  cacheTimestamp = 0;
}
