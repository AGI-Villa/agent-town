'use client';

import { useEffect, useRef, useCallback, useState } from 'react';

// Stardew Valley OST - Official/Fan uploads on YouTube
const STARDEW_PLAYLIST = [
  { id: 'FQSHcl6TJb4', name: 'Spring (It\'s a Big World Outside)' },
  { id: '2J1vUX_6hVE', name: 'Summer (Nature\'s Crescendo)' },
  { id: 'YptrnZGpuXs', name: 'Fall (The Smell of Mushroom)' },
  { id: 'e6MaGbMtjmQ', name: 'Winter (Nocturne of Ice)' },
  { id: 'SnHbi0sTBrE', name: 'Pelican Town' },
  { id: 'V7ImnYQgiOA', name: 'Cloud Country' },
];

const STORAGE_KEY = 'agent-town-youtube-prefs';

interface YouTubePrefs {
  volume: number;
  muted: boolean;
  currentIndex: number;
}

interface YouTubePlayer {
  playVideo: () => void;
  pauseVideo: () => void;
  setVolume: (volume: number) => void;
  mute: () => void;
  unMute: () => void;
  isMuted: () => boolean;
  getVolume: () => number;
  loadVideoById: (videoId: string) => void;
  destroy: () => void;
}

declare global {
  interface Window {
    YT: {
      Player: new (
        elementId: string,
        config: {
          height: string;
          width: string;
          videoId: string;
          playerVars: Record<string, number | string>;
          events: {
            onReady: (event: { target: YouTubePlayer }) => void;
            onStateChange: (event: { data: number }) => void;
            onError: (event: { data: number }) => void;
          };
        }
      ) => YouTubePlayer;
      PlayerState: {
        ENDED: number;
        PLAYING: number;
        PAUSED: number;
      };
    };
    onYouTubeIframeAPIReady: () => void;
  }
}

export type YouTubeBGMEventType = 'play' | 'pause' | 'next' | 'volumeChange' | 'muteChange' | 'ready' | 'error';

export interface YouTubeBGMEvent {
  type: YouTubeBGMEventType;
  trackIndex?: number;
  trackName?: string;
  volume?: number;
  muted?: boolean;
}

type EventCallback = (event: YouTubeBGMEvent) => void;

// Singleton state for YouTube BGM
class YouTubeBGMManager {
  private player: YouTubePlayer | null = null;
  private currentIndex = 0;
  private volume = 30; // YouTube uses 0-100
  private muted = true;
  private isPlaying = false;
  private isReady = false;
  private listeners: Set<EventCallback> = new Set();
  private initPromise: Promise<void> | null = null;

  constructor() {
    this.loadPrefs();
  }

  private loadPrefs(): void {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const prefs: YouTubePrefs = JSON.parse(stored);
        this.volume = prefs.volume ?? 30;
        this.muted = prefs.muted ?? true;
        this.currentIndex = prefs.currentIndex ?? 0;
      }
    } catch {
      // Ignore
    }
  }

  private savePrefs(): void {
    if (typeof window === 'undefined') return;
    try {
      const prefs: YouTubePrefs = {
        volume: this.volume,
        muted: this.muted,
        currentIndex: this.currentIndex,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      // Ignore
    }
  }

  private emit(event: YouTubeBGMEvent): void {
    this.listeners.forEach(cb => cb(event));
  }

  on(callback: EventCallback): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  async init(containerId: string): Promise<void> {
    if (this.initPromise) return this.initPromise;
    if (typeof window === 'undefined') return;

    this.initPromise = new Promise((resolve) => {
      // Load YouTube IFrame API
      if (!window.YT) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

        window.onYouTubeIframeAPIReady = () => {
          this.createPlayer(containerId, resolve);
        };
      } else {
        this.createPlayer(containerId, resolve);
      }
    });

    return this.initPromise;
  }

  private createPlayer(containerId: string, onReady: () => void): void {
    const track = STARDEW_PLAYLIST[this.currentIndex];
    
    this.player = new window.YT.Player(containerId, {
      height: '0',
      width: '0',
      videoId: track.id,
      playerVars: {
        autoplay: 0,
        controls: 0,
        disablekb: 1,
        fs: 0,
        modestbranding: 1,
        rel: 0,
        showinfo: 0,
        origin: window.location.origin,
      },
      events: {
        onReady: (event) => {
          this.isReady = true;
          event.target.setVolume(this.volume);
          if (this.muted) {
            event.target.mute();
          }
          this.emit({ type: 'ready' });
          onReady();
        },
        onStateChange: (event) => {
          if (event.data === window.YT.PlayerState.ENDED) {
            this.next();
          } else if (event.data === window.YT.PlayerState.PLAYING) {
            this.isPlaying = true;
            this.emit({
              type: 'play',
              trackIndex: this.currentIndex,
              trackName: STARDEW_PLAYLIST[this.currentIndex].name,
            });
          } else if (event.data === window.YT.PlayerState.PAUSED) {
            this.isPlaying = false;
            this.emit({ type: 'pause' });
          }
        },
        onError: () => {
          this.emit({ type: 'error' });
          // Try next track on error
          setTimeout(() => this.next(), 1000);
        },
      },
    });
  }

  async play(): Promise<boolean> {
    if (!this.player || !this.isReady) return false;
    try {
      this.player.playVideo();
      return true;
    } catch {
      return false;
    }
  }

  pause(): void {
    if (!this.player || !this.isReady) return;
    this.player.pauseVideo();
  }

  toggle(): void {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  next(): void {
    if (!this.player || !this.isReady) return;
    this.currentIndex = (this.currentIndex + 1) % STARDEW_PLAYLIST.length;
    const track = STARDEW_PLAYLIST[this.currentIndex];
    this.player.loadVideoById(track.id);
    this.savePrefs();
    this.emit({
      type: 'next',
      trackIndex: this.currentIndex,
      trackName: track.name,
    });
  }

  setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(100, vol));
    if (this.player && this.isReady) {
      this.player.setVolume(this.volume);
    }
    this.savePrefs();
    this.emit({ type: 'volumeChange', volume: this.volume / 100 });
  }

  getVolume(): number {
    return this.volume / 100;
  }

  mute(): void {
    this.muted = true;
    if (this.player && this.isReady) {
      this.player.mute();
    }
    this.savePrefs();
    this.emit({ type: 'muteChange', muted: true });
  }

  unmute(): void {
    this.muted = false;
    if (this.player && this.isReady) {
      this.player.unMute();
    }
    this.savePrefs();
    this.emit({ type: 'muteChange', muted: false });
  }

  toggleMute(): void {
    if (this.muted) {
      this.unmute();
    } else {
      this.mute();
    }
  }

  isMutedState(): boolean {
    return this.muted;
  }

  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  getIsReady(): boolean {
    return this.isReady;
  }

  getCurrentTrack(): { index: number; name: string; total: number } {
    return {
      index: this.currentIndex,
      name: STARDEW_PLAYLIST[this.currentIndex].name,
      total: STARDEW_PLAYLIST.length,
    };
  }

  destroy(): void {
    if (this.player) {
      this.player.destroy();
      this.player = null;
    }
    this.isReady = false;
    this.isPlaying = false;
    this.initPromise = null;
    this.listeners.clear();
  }
}

// Singleton instance
export const youtubeBGM = new YouTubeBGMManager();

interface YouTubeBGMProps {
  className?: string;
}

export function YouTubeBGM({ className = '' }: YouTubeBGMProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [volume, setVolume] = useState(0.3);
  const [trackName, setTrackName] = useState('');
  const [showVolume, setShowVolume] = useState(false);
  const [showPrompt, setShowPrompt] = useState(true);

  useEffect(() => {
    const containerId = 'youtube-bgm-player';
    
    // Create container if not exists
    if (containerRef.current && !document.getElementById(containerId)) {
      const div = document.createElement('div');
      div.id = containerId;
      div.style.position = 'absolute';
      div.style.left = '-9999px';
      div.style.top = '-9999px';
      containerRef.current.appendChild(div);
    }

    youtubeBGM.init(containerId).then(() => {
      setIsReady(true);
      setIsPlaying(youtubeBGM.getIsPlaying());
      setIsMuted(youtubeBGM.isMutedState());
      setVolume(youtubeBGM.getVolume());
      setTrackName(youtubeBGM.getCurrentTrack().name);
    });

    const unsubscribe = youtubeBGM.on((event) => {
      switch (event.type) {
        case 'play':
          setIsPlaying(true);
          setShowPrompt(false);
          if (event.trackName) setTrackName(event.trackName);
          break;
        case 'pause':
          setIsPlaying(false);
          break;
        case 'next':
          if (event.trackName) setTrackName(event.trackName);
          break;
        case 'volumeChange':
          if (event.volume !== undefined) setVolume(event.volume);
          break;
        case 'muteChange':
          if (event.muted !== undefined) setIsMuted(event.muted);
          break;
        case 'ready':
          setIsReady(true);
          setTrackName(youtubeBGM.getCurrentTrack().name);
          break;
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handlePlayClick = useCallback(async () => {
    if (!isReady) return;
    if (isPlaying) {
      youtubeBGM.pause();
    } else {
      await youtubeBGM.play();
      setShowPrompt(false);
    }
  }, [isReady, isPlaying]);

  const handleMuteClick = useCallback(() => {
    youtubeBGM.toggleMute();
  }, []);

  const handleNextClick = useCallback(() => {
    youtubeBGM.next();
  }, []);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    youtubeBGM.setVolume(newVolume * 100);
    if (newVolume > 0 && isMuted) {
      youtubeBGM.unmute();
    }
  }, [isMuted]);

  return (
    <div className={`flex items-center gap-2 ${className}`} ref={containerRef}>
      {/* First-time prompt */}
      {showPrompt && (
        <button
          onClick={handlePlayClick}
          disabled={!isReady}
          className="flex items-center gap-1.5 bg-[#ffa300]/90 hover:bg-[#ffa300] text-black px-3 py-1.5 rounded-lg transition-colors animate-pulse disabled:opacity-50"
        >
          <span className="text-sm">🎵</span>
          <span className="font-pixel text-[8px]">STARDEW OST</span>
        </button>
      )}

      {/* Main controls */}
      {!showPrompt && (
        <div className="flex items-center gap-1 bg-black/60 backdrop-blur-sm rounded-lg px-2 py-1.5">
          {/* Play/Pause */}
          <button
            onClick={handlePlayClick}
            disabled={!isReady}
            className="w-6 h-6 flex items-center justify-center hover:bg-white/10 rounded transition-colors disabled:opacity-50"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            <span className="text-sm">{isPlaying ? '⏸️' : '▶️'}</span>
          </button>

          {/* Mute/Unmute */}
          <button
            onClick={handleMuteClick}
            className="w-6 h-6 flex items-center justify-center hover:bg-white/10 rounded transition-colors"
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            <span className="text-sm">{isMuted ? '🔇' : '🔊'}</span>
          </button>

          {/* Volume slider toggle */}
          <button
            onClick={() => setShowVolume(!showVolume)}
            className="w-6 h-6 flex items-center justify-center hover:bg-white/10 rounded transition-colors"
            title="Volume"
          >
            <span className="text-sm">🔉</span>
          </button>

          {/* Volume slider */}
          {showVolume && (
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={handleVolumeChange}
              className="w-16 h-1 accent-[#ffa300] cursor-pointer"
              title={`Volume: ${Math.round(volume * 100)}%`}
            />
          )}

          {/* Next track */}
          <button
            onClick={handleNextClick}
            className="w-6 h-6 flex items-center justify-center hover:bg-white/10 rounded transition-colors"
            title="Next track"
          >
            <span className="text-sm">⏭️</span>
          </button>

          {/* Track name with Stardew label */}
          <span className="font-pixel text-[7px] text-[#83769c] ml-1 max-w-[100px] truncate" title={trackName}>
            🌾 {trackName}
          </span>
        </div>
      )}
    </div>
  );
}

export default YouTubeBGM;
