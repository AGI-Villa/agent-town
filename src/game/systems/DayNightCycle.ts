import Phaser from 'phaser';
import { PICO8_COLORS } from '../tiles/palette';

export type TimeOfDay = 'day' | 'dusk' | 'night' | 'dawn';

export interface DayNightConfig {
  cycleDurationMs: number; // Full cycle duration
  startTime?: TimeOfDay;
}

// Color tints for each time of day
const TIME_TINTS: Record<TimeOfDay, number> = {
  day: 0xffffff,    // No tint
  dusk: 0xffaa77,   // Orange tint
  night: 0x4466aa,  // Blue tint
  dawn: 0xffddaa,   // Warm yellow
};

// Ambient light levels
const AMBIENT_LEVELS: Record<TimeOfDay, number> = {
  day: 1.0,
  dusk: 0.8,
  night: 0.5,
  dawn: 0.7,
};

// Time distribution (percentage of cycle)
const TIME_DISTRIBUTION: Record<TimeOfDay, { start: number; end: number }> = {
  dawn: { start: 0, end: 0.1 },
  day: { start: 0.1, end: 0.5 },
  dusk: { start: 0.5, end: 0.6 },
  night: { start: 0.6, end: 1.0 },
};

export class DayNightCycle {
  private scene: Phaser.Scene;
  private overlay: Phaser.GameObjects.Rectangle | null = null;
  private currentTime: TimeOfDay = 'day';
  private cycleProgress: number = 0;
  private cycleDurationMs: number;
  private isRunning: boolean = false;
  private lastUpdateTime: number = 0;
  private listeners: Set<(time: TimeOfDay) => void> = new Set();

  constructor(scene: Phaser.Scene, config: DayNightConfig) {
    this.scene = scene;
    this.cycleDurationMs = config.cycleDurationMs;
    if (config.startTime) {
      this.currentTime = config.startTime;
      this.cycleProgress = TIME_DISTRIBUTION[config.startTime].start;
    }
  }

  create(width: number, height: number): void {
    // Create overlay for tinting
    this.overlay = this.scene.add.rectangle(
      width / 2,
      height / 2,
      width,
      height,
      0x000000,
      0
    );
    this.overlay.setDepth(999);
    this.overlay.setBlendMode(Phaser.BlendModes.MULTIPLY);
    
    this.updateVisuals();
  }

  start(): void {
    this.isRunning = true;
    this.lastUpdateTime = Date.now();
  }

  stop(): void {
    this.isRunning = false;
  }

  update(): void {
    if (!this.isRunning) return;

    const now = Date.now();
    const delta = now - this.lastUpdateTime;
    this.lastUpdateTime = now;

    // Update cycle progress
    this.cycleProgress += delta / this.cycleDurationMs;
    if (this.cycleProgress >= 1) {
      this.cycleProgress -= 1;
    }

    // Determine current time of day
    const newTime = this.getTimeOfDay();
    if (newTime !== this.currentTime) {
      this.currentTime = newTime;
      this.notifyListeners();
    }

    this.updateVisuals();
  }

  private getTimeOfDay(): TimeOfDay {
    for (const [time, range] of Object.entries(TIME_DISTRIBUTION)) {
      if (this.cycleProgress >= range.start && this.cycleProgress < range.end) {
        return time as TimeOfDay;
      }
    }
    return 'day';
  }

  private updateVisuals(): void {
    if (!this.overlay) return;

    const tint = TIME_TINTS[this.currentTime];
    const alpha = 1 - AMBIENT_LEVELS[this.currentTime];

    // Smooth transition
    const targetAlpha = Math.min(0.25, alpha);
    this.overlay.setFillStyle(this.invertTint(tint), targetAlpha);
  }

  private invertTint(tint: number): number {
    // Convert tint to overlay color
    const r = 255 - ((tint >> 16) & 0xff);
    const g = 255 - ((tint >> 8) & 0xff);
    const b = 255 - (tint & 0xff);
    return (r << 16) | (g << 8) | b;
  }

  setTime(time: TimeOfDay): void {
    this.currentTime = time;
    this.cycleProgress = TIME_DISTRIBUTION[time].start;
    this.updateVisuals();
    this.notifyListeners();
  }

  getCurrentTime(): TimeOfDay {
    return this.currentTime;
  }

  getCycleProgress(): number {
    return this.cycleProgress;
  }

  onTimeChange(callback: (time: TimeOfDay) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notifyListeners(): void {
    this.listeners.forEach(cb => cb(this.currentTime));
  }

  // Get display string for current time
  getTimeString(): string {
    const hour = Math.floor(this.cycleProgress * 24);
    const minute = Math.floor((this.cycleProgress * 24 * 60) % 60);
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  }

  destroy(): void {
    this.stop();
    if (this.overlay) {
      this.overlay.destroy();
      this.overlay = null;
    }
    this.listeners.clear();
  }
}
