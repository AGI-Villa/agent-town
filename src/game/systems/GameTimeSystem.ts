import Phaser from 'phaser';

export type TimeSpeed = 1 | 10 | 60;

export interface GameTimeConfig {
  startHour?: number;
  startMinute?: number;
  speed?: TimeSpeed;
}

type TimeChangeCallback = (hour: number, minute: number) => void;

export class GameTimeSystem {
  private scene: Phaser.Scene;
  private hour: number;
  private minute: number;
  private speed: TimeSpeed;
  private isRunning: boolean = false;
  private lastUpdateTime: number = 0;
  private accumulatedMs: number = 0;
  private listeners: Set<TimeChangeCallback> = new Set();

  // 1 real second = 1 game minute at 1x speed
  private static readonly MS_PER_GAME_MINUTE = 1000;

  constructor(scene: Phaser.Scene, config: GameTimeConfig = {}) {
    this.scene = scene;
    this.hour = config.startHour ?? 9;
    this.minute = config.startMinute ?? 0;
    this.speed = config.speed ?? 1;
  }

  start(): void {
    this.isRunning = true;
    this.lastUpdateTime = Date.now();
    this.accumulatedMs = 0;
  }

  stop(): void {
    this.isRunning = false;
  }

  update(): void {
    if (!this.isRunning) return;

    const now = Date.now();
    const delta = now - this.lastUpdateTime;
    this.lastUpdateTime = now;

    this.accumulatedMs += delta * this.speed;

    const minutesToAdd = Math.floor(this.accumulatedMs / GameTimeSystem.MS_PER_GAME_MINUTE);
    if (minutesToAdd > 0) {
      this.accumulatedMs %= GameTimeSystem.MS_PER_GAME_MINUTE;
      this.advanceTime(minutesToAdd);
    }
  }

  private advanceTime(minutes: number): void {
    const oldHour = this.hour;
    
    this.minute += minutes;
    while (this.minute >= 60) {
      this.minute -= 60;
      this.hour = (this.hour + 1) % 24;
    }

    if (this.hour !== oldHour || minutes > 0) {
      this.notifyListeners();
    }
  }

  setTime(hour: number, minute: number = 0): void {
    this.hour = hour % 24;
    this.minute = minute % 60;
    this.notifyListeners();
  }

  setSpeed(speed: TimeSpeed): void {
    this.speed = speed;
  }

  getSpeed(): TimeSpeed {
    return this.speed;
  }

  getHour(): number {
    return this.hour;
  }

  getMinute(): number {
    return this.minute;
  }

  getTimeString(): string {
    return `${this.hour.toString().padStart(2, '0')}:${this.minute.toString().padStart(2, '0')}`;
  }

  // Get time as decimal (e.g., 9.5 for 9:30)
  getDecimalTime(): number {
    return this.hour + this.minute / 60;
  }

  // Check if current time is within a range (handles overnight ranges)
  isWithinRange(startHour: number, endHour: number): boolean {
    if (startHour > endHour) {
      // Overnight range (e.g., 23-7)
      return this.hour >= startHour || this.hour < endHour;
    }
    return this.hour >= startHour && this.hour < endHour;
  }

  onTimeChange(callback: TimeChangeCallback): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notifyListeners(): void {
    this.listeners.forEach(cb => cb(this.hour, this.minute));
  }

  isRunningState(): boolean {
    return this.isRunning;
  }

  destroy(): void {
    this.stop();
    this.listeners.clear();
  }
}
