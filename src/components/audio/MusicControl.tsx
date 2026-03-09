'use client';

import { useState, useEffect, useCallback } from 'react';
import { AudioManager } from '@/game/audio';

interface MusicControlProps {
  className?: string;
}

export function MusicControl({ className = '' }: MusicControlProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [volume, setVolume] = useState(0.3);
  const [showPrompt, setShowPrompt] = useState(true);
  const [trackName, setTrackName] = useState('');
  const [showVolume, setShowVolume] = useState(false);

  useEffect(() => {
    // Initialize audio manager
    AudioManager.init();
    
    // Sync state
    setIsPlaying(AudioManager.getIsPlaying());
    setIsMuted(AudioManager.isMuted());
    setVolume(AudioManager.getVolume());
    setShowPrompt(!AudioManager.getHasInteracted());
    setTrackName(AudioManager.getCurrentTrack().name);

    // Subscribe to events
    const unsubscribe = AudioManager.on((event) => {
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
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handlePlayClick = useCallback(async () => {
    if (isPlaying) {
      AudioManager.pause();
    } else {
      const success = await AudioManager.play();
      if (success) {
        setShowPrompt(false);
      }
    }
  }, [isPlaying]);

  const handleMuteClick = useCallback(() => {
    AudioManager.toggleMute();
  }, []);

  const handleNextClick = useCallback(() => {
    AudioManager.next();
  }, []);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    AudioManager.setVolume(newVolume);
    if (newVolume > 0 && isMuted) {
      AudioManager.unmute();
    }
  }, [isMuted]);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* First-time prompt */}
      {showPrompt && (
        <button
          onClick={handlePlayClick}
          className="flex items-center gap-1.5 bg-[#ffa300]/90 hover:bg-[#ffa300] text-black px-3 py-1.5 rounded-lg transition-colors animate-pulse"
        >
          <span className="text-sm">🎵</span>
          <span className="font-pixel text-[8px]">PLAY BGM</span>
        </button>
      )}

      {/* Main controls (show after first interaction) */}
      {!showPrompt && (
        <div className="flex items-center gap-1 bg-black/60 backdrop-blur-sm rounded-lg px-2 py-1.5">
          {/* Play/Pause */}
          <button
            onClick={handlePlayClick}
            className="w-6 h-6 flex items-center justify-center hover:bg-white/10 rounded transition-colors"
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

          {/* Volume slider (expandable) */}
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

          {/* Track name */}
          <span className="font-pixel text-[7px] text-[#83769c] ml-1 max-w-[80px] truncate" title={trackName}>
            {trackName}
          </span>
        </div>
      )}
    </div>
  );
}

export default MusicControl;
