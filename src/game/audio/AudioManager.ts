/**
 * AudioManager - Background music system with Stardew Valley style BGM
 * Features:
 * - Playlist rotation (multiple tracks)
 * - Volume control with localStorage persistence
 * - Mute toggle
 * - Browser autoplay policy compliance (requires user interaction)
 */

const STORAGE_KEY = 'agent-town-audio-prefs';
const DEFAULT_VOLUME = 0.3;

interface AudioPrefs {
  volume: number;
  muted: boolean;
  hasInteracted: boolean;
}

type AudioEventCallback = (event: AudioEvent) => void;

interface AudioEvent {
  type: 'play' | 'pause' | 'next' | 'volumeChange' | 'muteChange';
  trackIndex?: number;
  trackName?: string;
  volume?: number;
  muted?: boolean;
}

class AudioManagerClass {
  private audio: HTMLAudioElement | null = null;
  private playlist: string[] = [
    '/assets/audio/town-morning.mp3',
    '/assets/audio/town-afternoon.mp3',
    '/assets/audio/town-evening.mp3',
  ];
  private trackNames: string[] = [
    'Morning Breeze',
    'Afternoon Stroll',
    'Evening Calm',
  ];
  private currentIndex: number = 0;
  private volume: number = DEFAULT_VOLUME;
  private muted: boolean = true; // Default muted for first visit
  private hasInteracted: boolean = false;
  private isPlaying: boolean = false;
  private initialized: boolean = false;
  private listeners: Set<AudioEventCallback> = new Set();

  constructor() {
    this.loadPrefs();
  }

  /**
   * Initialize the audio system. Call this once when the game starts.
   */
  init(): void {
    if (this.initialized || typeof window === 'undefined') return;
    
    this.audio = new Audio();
    this.audio.volume = this.muted ? 0 : this.volume;
    this.audio.loop = false;
    
    // Auto-play next track when current ends
    this.audio.addEventListener('ended', () => {
      this.next();
    });
    
    // Handle errors gracefully
    this.audio.addEventListener('error', (e) => {
      console.warn('Audio playback error:', e);
      // Try next track on error
      this.time(() => this.next(), 1000);
    });
    
    this.loadTrack(this.currentIndex);
    this.initialized = true;
  }

  private time(fn: () => void, ms: number): void {
    setTimeout(fn, ms);
  }

  private loadTrack(index: number): void {
    if (!this.audio) return;
    this.currentIndex = index % this.playlist.length;
    this.audio.src = this.playlist[this.currentIndex];
    this.audio.load();
  }

  private loadPrefs(): void {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const prefs: AudioPrefs = JSON.parse(stored);
        this.volume = prefs.volume ?? DEFAULT_VOLUME;
        this.muted = prefs.muted ?? true;
        this.hasInteracted = prefs.hasInteracted ?? false;
      }
    } catch {
      // Ignore parse errors
    }
  }

  private savePrefs(): void {
    if (typeof window === 'undefined') return;
    try {
      const prefs: AudioPrefs = {
        volume: this.volume,
        muted: this.muted,
        hasInteracted: this.hasInteracted,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      // Ignore storage errors
    }
  }

  private emit(event: AudioEvent): void {
    this.listeners.forEach(cb => cb(event));
  }

  /**
   * Subscribe to audio events
   */
  on(callback: AudioEventCallback): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Start playing music. Requires user interaction first due to browser policy.
   */
  async play(): Promise<boolean> {
    if (!this.audio || !this.initialized) {
      this.init();
    }
    if (!this.audio) return false;

    try {
      this.hasInteracted = true;
      this.audio.volume = this.muted ? 0 : this.volume;
      await this.audio.play();
      this.isPlaying = true;
      this.savePrefs();
      this.emit({
        type: 'play',
        trackIndex: this.currentIndex,
        trackName: this.trackNames[this.currentIndex],
      });
      return true;
    } catch (err) {
      console.warn('Audio play failed (likely needs user interaction):', err);
      return false;
    }
  }

  /**
   * Pause music playback
   */
  pause(): void {
    if (!this.audio) return;
    this.audio.pause();
    this.isPlaying = false;
    this.emit({ type: 'pause' });
  }

  /**
   * Toggle play/pause
   */
  toggle(): void {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  /**
   * Skip to next track
   */
  next(): void {
    const wasPlaying = this.isPlaying;
    this.loadTrack(this.currentIndex + 1);
    if (wasPlaying) {
      this.play();
    }
    this.emit({
      type: 'next',
      trackIndex: this.currentIndex,
      trackName: this.trackNames[this.currentIndex],
    });
  }

  /**
   * Set volume (0-1)
   */
  setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.audio && !this.muted) {
      this.audio.volume = this.volume;
    }
    this.savePrefs();
    this.emit({ type: 'volumeChange', volume: this.volume });
  }

  /**
   * Get current volume
   */
  getVolume(): number {
    return this.volume;
  }

  /**
   * Mute audio
   */
  mute(): void {
    this.muted = true;
    if (this.audio) {
      this.audio.volume = 0;
    }
    this.savePrefs();
    this.emit({ type: 'muteChange', muted: true });
  }

  /**
   * Unmute audio
   */
  unmute(): void {
    this.muted = false;
    if (this.audio) {
      this.audio.volume = this.volume;
    }
    this.savePrefs();
    this.emit({ type: 'muteChange', muted: false });
  }

  /**
   * Toggle mute state
   */
  toggleMute(): void {
    if (this.muted) {
      this.unmute();
    } else {
      this.mute();
    }
  }

  /**
   * Check if currently muted
   */
  isMuted(): boolean {
    return this.muted;
  }

  /**
   * Check if currently playing
   */
  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  /**
   * Check if user has interacted (for showing prompt)
   */
  getHasInteracted(): boolean {
    return this.hasInteracted;
  }

  /**
   * Get current track info
   */
  getCurrentTrack(): { index: number; name: string; total: number } {
    return {
      index: this.currentIndex,
      name: this.trackNames[this.currentIndex],
      total: this.playlist.length,
    };
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.audio) {
      this.audio.pause();
      this.audio.src = '';
      this.audio = null;
    }
    this.listeners.clear();
    this.initialized = false;
    this.isPlaying = false;
  }
}

// Singleton instance
export const AudioManager = new AudioManagerClass();
export default AudioManager;
