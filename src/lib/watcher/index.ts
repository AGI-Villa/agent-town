/**
 * Watcher Service — monitors ~/.openclaw/agents/ for JSONL file changes
 * using chokidar and writes parsed events to Supabase.
 *
 * Key behaviors:
 * - On "add" (existing file): skip to tail (last TAIL_BYTES) to avoid
 *   flooding the DB with historical data from multi-MB session logs.
 * - On "change" (new writes): read incrementally from the last offset.
 * - Auto-starts when the module is first imported in the server process.
 */

import { watch, type FSWatcher } from "chokidar";
import { stat } from "fs/promises";
import type { Stats } from "fs";
import { resolve } from "path";
import { homedir } from "os";
import { readJsonlFile } from "./jsonl-parser";
import { writeEvents } from "./event-writer";

export interface WatcherStatus {
  running: boolean;
  watchPath: string;
  trackedFiles: number;
  totalEventsProcessed: number;
  startedAt: string | null;
  errors: string[];
}

const WATCH_PATH = resolve(homedir(), ".openclaw", "agents");
const MAX_ERRORS = 50;
// For existing files, only tail the last 100KB to avoid mass-importing history
const TAIL_BYTES = 100 * 1024;

/**
 * chokidar v4/v5 removed glob support. We watch the directory directly
 * and use an `ignored` function to filter for session JSONL files only.
 */
function isIgnored(filePath: string, stats?: Stats | null): boolean {
  // Always recurse into directories
  if (!stats || stats.isDirectory()) return false;
  // For files: only track .jsonl files under a sessions/ directory, skip .deleted backups
  return (
    !filePath.endsWith(".jsonl") ||
    !filePath.includes("/sessions/") ||
    filePath.includes(".deleted.")
  );
}

class WatcherService {
  private watcher: FSWatcher | null = null;
  private fileOffsets: Map<string, number> = new Map();
  private totalEventsProcessed = 0;
  private startedAt: string | null = null;
  private errors: string[] = [];

  get running(): boolean {
    return this.watcher !== null;
  }

  getStatus(): WatcherStatus {
    return {
      running: this.running,
      watchPath: WATCH_PATH,
      trackedFiles: this.fileOffsets.size,
      totalEventsProcessed: this.totalEventsProcessed,
      startedAt: this.startedAt,
      errors: this.errors.slice(-10),
    };
  }

  async start(): Promise<void> {
    if (this.watcher) return; // already running, silently skip

    this.watcher = watch(WATCH_PATH, {
      persistent: true,
      // ignoreInitial: false so we pick up existing active session files
      ignoreInitial: false,
      // chokidar v5 no longer supports globs — filter via function instead
      ignored: isIgnored,
      awaitWriteFinish: {
        stabilityThreshold: 300,
        pollInterval: 100,
      },
    });

    this.startedAt = new Date().toISOString();

    // "add" fires for pre-existing files when watcher starts.
    // Set offset to near the end so we only read recent content.
    this.watcher.on("add", (filePath: string) => {
      this.handleExistingFile(filePath);
    });

    // "change" fires when new bytes are appended to a file.
    // Read only the new content since last offset.
    this.watcher.on("change", (filePath: string) => {
      this.handleFileChange(filePath);
    });

    this.watcher.on("error", (error: unknown) => {
      const msg = error instanceof Error ? error.message : String(error);
      this.addError(`Watcher error: ${msg}`);
    });

    console.log(`[watcher] Started watching: ${WATCH_PATH} (filtering sessions/*.jsonl)`);
  }

  async stop(): Promise<void> {
    if (!this.watcher) {
      throw new Error("Watcher is not running");
    }

    await this.watcher.close();
    this.watcher = null;
    this.fileOffsets.clear();
    this.startedAt = null;
    console.log("[watcher] Stopped");
  }

  /**
   * Called when watcher first sees a file (including pre-existing files).
   * Skips to near the end of the file to avoid importing all historical data.
   */
  private async handleExistingFile(filePath: string): Promise<void> {
    try {
      const fileStat = await stat(filePath);
      const fileSize = fileStat.size;
      // Start from tail: skip all but the last TAIL_BYTES
      const tailOffset = Math.max(0, fileSize - TAIL_BYTES);
      this.fileOffsets.set(filePath, tailOffset);

      // Now read and write just that tail portion
      await this.handleFileChange(filePath);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      this.addError(`Error initializing ${filePath}: ${msg}`);
    }
  }

  /**
   * Called when file content changes. Reads new content since last offset
   * and writes events to Supabase in small batches.
   */
  private async handleFileChange(filePath: string): Promise<void> {
    const currentOffset = this.fileOffsets.get(filePath) ?? 0;

    try {
      const { events, newOffset } = await readJsonlFile(filePath, currentOffset);

      if (events.length === 0) return;

      this.fileOffsets.set(filePath, newOffset);

      const written = await writeEvents(events);
      this.totalEventsProcessed += written;

      if (written > 0) {
        console.log(`[watcher] Wrote ${written} events from ${filePath.split("/").slice(-3).join("/")}`);
      }

      if (written < events.length) {
        this.addError(`Partial write: ${written}/${events.length} from ${filePath}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      this.addError(`Error processing ${filePath}: ${msg}`);
    }
  }

  private addError(message: string): void {
    console.error(`[watcher] ${message}`);
    this.errors.push(`${new Date().toISOString()} ${message}`);
    if (this.errors.length > MAX_ERRORS) {
      this.errors = this.errors.slice(-MAX_ERRORS);
    }
  }
}

// Singleton instance — started via src/instrumentation.ts on server boot
export const watcherService = new WatcherService();
