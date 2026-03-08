'use client';

import { useState, useEffect, useCallback } from 'react';
import type { TimeSpeed } from '@/game/systems/GameTimeSystem';

interface TimeControlProps {
  onSpeedChange?: (speed: TimeSpeed) => void;
  onTimeSet?: (hour: number) => void;
}

export function TimeControl({ onSpeedChange, onTimeSet }: TimeControlProps) {
  const [currentTime, setCurrentTime] = useState({ hour: 9, minute: 0 });
  const [speed, setSpeed] = useState<TimeSpeed>(1);

  const speeds: TimeSpeed[] = [1, 10, 60];

  const handleSpeedClick = useCallback((newSpeed: TimeSpeed) => {
    setSpeed(newSpeed);
    onSpeedChange?.(newSpeed);
  }, [onSpeedChange]);

  const handleTimeClick = useCallback((hour: number) => {
    setCurrentTime({ hour, minute: 0 });
    onTimeSet?.(hour);
  }, [onTimeSet]);

  const formatTime = (hour: number, minute: number) => {
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  };

  const getTimeOfDayLabel = (hour: number) => {
    if (hour >= 6 && hour < 12) return '🌅 Morning';
    if (hour >= 12 && hour < 18) return '☀️ Afternoon';
    if (hour >= 18 && hour < 22) return '🌆 Evening';
    return '🌙 Night';
  };

  // Quick time presets
  const timePresets = [
    { label: '🌅 6:00', hour: 6 },
    { label: '☀️ 12:00', hour: 12 },
    { label: '🌆 18:00', hour: 18 },
    { label: '🌙 23:00', hour: 23 },
  ];

  return (
    <div className="bg-slate-800/90 rounded-lg p-3 text-white text-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-lg">
          {formatTime(currentTime.hour, currentTime.minute)}
        </span>
        <span className="text-slate-400 text-xs">
          {getTimeOfDayLabel(currentTime.hour)}
        </span>
      </div>

      {/* Speed controls */}
      <div className="flex gap-1 mb-2">
        <span className="text-slate-400 text-xs mr-2">Speed:</span>
        {speeds.map((s) => (
          <button
            key={s}
            onClick={() => handleSpeedClick(s)}
            className={`px-2 py-1 rounded text-xs transition-colors ${
              speed === s
                ? 'bg-yellow-500 text-black'
                : 'bg-slate-700 hover:bg-slate-600'
            }`}
          >
            {s}x
          </button>
        ))}
      </div>

      {/* Time presets */}
      <div className="flex gap-1">
        {timePresets.map((preset) => (
          <button
            key={preset.hour}
            onClick={() => handleTimeClick(preset.hour)}
            className="px-2 py-1 rounded text-xs bg-slate-700 hover:bg-slate-600 transition-colors"
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* Keyboard hints */}
      <div className="mt-2 text-slate-500 text-xs">
        <span>, . / = speed</span>
      </div>
    </div>
  );
}

// Hook to sync with game time
export function useGameTime(scene: { getGameTime?: () => { hour: number; minute: number }; getTimeSpeed?: () => TimeSpeed } | null) {
  const [time, setTime] = useState({ hour: 9, minute: 0 });
  const [speed, setSpeed] = useState<TimeSpeed>(1);

  useEffect(() => {
    if (!scene?.getGameTime) return;

    const interval = setInterval(() => {
      const gameTime = scene.getGameTime?.();
      if (gameTime) {
        setTime(gameTime);
      }
      const gameSpeed = scene.getTimeSpeed?.();
      if (gameSpeed) {
        setSpeed(gameSpeed);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [scene]);

  return { time, speed };
}
