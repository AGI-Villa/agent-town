import { NextResponse } from "next/server";
import { readdir, stat } from "fs/promises";
import { resolve } from "path";
import { homedir } from "os";
import type { AgentStatus } from "@/lib/types";

const AGENTS_PATH = resolve(homedir(), ".openclaw", "agents");

// Status thresholds based on last file modification time
const ONLINE_THRESHOLD_MS = 10 * 60 * 1000;   // 10 minutes → ONLINE
const IDLE_THRESHOLD_MS   = 60 * 60 * 1000;   // 1 hour      → IDLE
// beyond 1 hour → OFFLINE

async function getAgentStatus(agentId: string): Promise<AgentStatus | null> {
  const sessionsPath = resolve(AGENTS_PATH, agentId, "sessions");

  try {
    const files = await readdir(sessionsPath);
    const jsonlFiles = files.filter(
      (f) => f.endsWith(".jsonl") && !f.includes(".deleted")
    );

    if (jsonlFiles.length === 0) return null;

    // Find the most recently modified JSONL file
    let latestMtime = 0;
    let totalSize = 0;

    for (const file of jsonlFiles) {
      const fileStat = await stat(resolve(sessionsPath, file));
      totalSize += fileStat.size;
      if (fileStat.mtimeMs > latestMtime) {
        latestMtime = fileStat.mtimeMs;
      }
    }

    const now = Date.now();
    const diffMs = now - latestMtime;
    let status: "online" | "idle" | "offline";
    if (diffMs <= ONLINE_THRESHOLD_MS) {
      status = "online";
    } else if (diffMs <= IDLE_THRESHOLD_MS) {
      status = "idle";
    } else {
      status = "offline";
    }

    return {
      agent_id: agentId,
      status,
      last_event_at: new Date(latestMtime).toISOString(),
      // Approximate event count from total file size (each line ~200 bytes avg)
      event_count_24h: Math.round(totalSize / 200),
      last_event_type: null,
    };
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const entries = await readdir(AGENTS_PATH, { withFileTypes: true });
    const agentDirs = entries
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      // Skip ops- agents with no sessions yet
      .filter((name) => !name.startsWith("ops-") && name !== "sync-agent");

    const results = await Promise.all(agentDirs.map(getAgentStatus));
    const agents = results.filter((a): a is AgentStatus => a !== null);

    // Sort: online first, then idle, then offline
    const statusOrder = { online: 0, idle: 1, offline: 2 };
    agents.sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);

    return NextResponse.json(agents);
  } catch (err) {
    console.error("[api/agents] Failed to read agents directory:", err);
    return NextResponse.json({ error: "Failed to read agents" }, { status: 500 });
  }
}
