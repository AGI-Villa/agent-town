/**
 * Watcher Service — monitors ~/.openclaw/agents/ for JSONL file changes
 * using chokidar and writes parsed events to Supabase.
 */

import { watch, type FSWatcher } from "chokidar";
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
const GLOB_PATTERN = "**/*.jsonl";
const MAX_ERRORS = 50;

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
    if (this.watcher) {
      throw new Error("Watcher is already running");
    }

    const watchGlob = resolve(WATCH_PATH, GLOB_PATTERN);

    this.watcher = watch(watchGlob, {
      persistent: true,
      ignoreInitial: false,
      awaitWriteFinish: {
        stabilityThreshold: 500,
        pollInterval: 100,
      },
    });

    this.startedAt = new Date().toISOString();

    this.watcher.on("add", (filePath: string) => {
      this.handleFileChange(filePath);
    });

    this.watcher.on("change", (filePath: string) => {
      this.handleFileChange(filePath);
    });

    this.watcher.on("error", (error: unknown) => {
      const msg = error instanceof Error ? error.message : String(error);
      this.addError(`Watcher error: ${msg}`);
    });

    console.log(`[watcher] Started watching: ${watchGlob}`);
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

  private async handleFileChange(filePath: string): Promise<void> {
    const currentOffset = this.fileOffsets.get(filePath) ?? 0;

    try {
      const { events, newOffset } = await readJsonlFile(filePath, currentOffset);

      if (events.length === 0) return;

      this.fileOffsets.set(filePath, newOffset);

      const written = await writeEvents(events);
      this.totalEventsProcessed += written;

      if (written > 0) {
        console.log(`[watcher] Processed ${written} events from ${filePath}`);
      }

      if (written < events.length) {
        this.addError(`Partial write: ${written}/${events.length} events from ${filePath}`);
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

// Singleton instance
export const watcherService = new WatcherService();
