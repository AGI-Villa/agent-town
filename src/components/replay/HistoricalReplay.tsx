'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useTranslations } from 'next-intl';

interface ReplayEvent {
  id: string;
  agent_id: string;
  agent_name: string;
  agent_role: string;
  event_type: string;
  icon: string;
  summary: string;
  timestamp: string;
  game_hour: number;
  game_minute: number;
}

interface ReplayMoment {
  id: string;
  agent_id: string;
  agent_name: string;
  content: string;
  emotion: string | null;
  timestamp: string;
  game_hour: number;
  game_minute: number;
}

interface ReplayData {
  date: string;
  events: ReplayEvent[];
  moments: ReplayMoment[];
  agents: { id: string; name: string }[];
  hasData: boolean;
}

type ReplaySpeed = 1 | 2 | 5 | 10;

interface TimelineItem {
  type: 'event' | 'moment';
  timestamp: string;
  hour: number;
  minute: number;
  data: ReplayEvent | ReplayMoment;
}

const EMOTION_MAP: Record<string, string> = {
  happy: "😊",
  sad: "😢",
  excited: "🎉",
  angry: "😤",
  curious: "🤔",
  tired: "😴",
  neutral: "😐",
  proud: "😎",
  anxious: "😰",
  creative: "🎨",
  frustrated: "😤",
  amused: "😄",
  focused: "🎯",
  surprised: "😮",
};

export function HistoricalReplay() {
  const t = useTranslations('replay');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [replayData, setReplayData] = useState<ReplayData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Replay state
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<ReplaySpeed>(1);
  const [currentTime, setCurrentTime] = useState({ hour: 0, minute: 0 });
  const [visibleItems, setVisibleItems] = useState<TimelineItem[]>([]);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  // Get available dates (last 30 days)
  const availableDates = useMemo(() => {
    const dates: string[] = [];
    const today = new Date();
    for (let i = 1; i <= 30; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      dates.push(d.toISOString().split('T')[0]);
    }
    return dates;
  }, []);

  // Merge events and moments into timeline
  const timeline = useMemo(() => {
    if (!replayData) return [];
    
    const items: TimelineItem[] = [];
    
    for (const event of replayData.events) {
      items.push({
        type: 'event',
        timestamp: event.timestamp,
        hour: event.game_hour,
        minute: event.game_minute,
        data: event,
      });
    }
    
    for (const moment of replayData.moments) {
      items.push({
        type: 'moment',
        timestamp: moment.timestamp,
        hour: moment.game_hour,
        minute: moment.game_minute,
        data: moment,
      });
    }
    
    // Sort by timestamp
    items.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    
    return items;
  }, [replayData]);

  // Fetch replay data for selected date
  const fetchReplayData = useCallback(async (date: string) => {
    setLoading(true);
    setError(null);
    setIsPlaying(false);
    setCurrentTime({ hour: 0, minute: 0 });
    setVisibleItems([]);
    
    try {
      const res = await fetch(`/api/replay?date=${date}`);
      if (!res.ok) throw new Error('Failed to fetch replay data');
      const data: ReplayData = await res.json();
      setReplayData(data);
      
      // Set initial time to first event's time
      if (data.events.length > 0 || data.moments.length > 0) {
        const firstItem = [...data.events, ...data.moments].sort(
          (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        )[0];
        if (firstItem) {
          const d = new Date(firstItem.timestamp);
          setCurrentTime({ hour: d.getUTCHours(), minute: d.getUTCMinutes() });
        }
      }
    } catch (err) {
      console.error('Failed to fetch replay data:', err);
      setError(t('fetchError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  // Handle date selection
  const handleDateChange = (date: string) => {
    setSelectedDate(date);
    if (date) {
      fetchReplayData(date);
    }
  };

  // Update visible items based on current time
  useEffect(() => {
    if (!timeline.length) return;
    
    const currentMinutes = currentTime.hour * 60 + currentTime.minute;
    const visible = timeline.filter((item) => {
      const itemMinutes = item.hour * 60 + item.minute;
      return itemMinutes <= currentMinutes;
    });
    
    setVisibleItems(visible);
    
    // Auto-scroll to bottom
    if (timelineRef.current) {
      timelineRef.current.scrollTop = timelineRef.current.scrollHeight;
    }
  }, [currentTime, timeline]);

  // Replay timer
  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        setCurrentTime((prev) => {
          let newMinute = prev.minute + 1;
          let newHour = prev.hour;
          
          if (newMinute >= 60) {
            newMinute = 0;
            newHour += 1;
          }
          
          // Stop at end of day
          if (newHour >= 24) {
            setIsPlaying(false);
            return { hour: 23, minute: 59 };
          }
          
          return { hour: newHour, minute: newMinute };
        });
      }, 1000 / speed); // Speed affects interval
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPlaying, speed]);

  // Format time display
  const formatTime = (hour: number, minute: number) => {
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  };

  // Time presets
  const timePresets = [
    { label: '🌅 06:00', hour: 6 },
    { label: '☀️ 12:00', hour: 12 },
    { label: '🌆 18:00', hour: 18 },
    { label: '🌙 22:00', hour: 22 },
  ];

  const speeds: ReplaySpeed[] = [1, 2, 5, 10];

  return (
    <div className="space-y-4">
      {/* Date Picker */}
      <div className="bg-[#1d2b53] border border-[#5f574f] rounded-lg p-4">
        <label className="block font-pixel text-[10px] text-[#c2c3c7] mb-2">
          {t('selectDate')}
        </label>
        <select
          value={selectedDate}
          onChange={(e) => handleDateChange(e.target.value)}
          className="w-full font-pixel text-[10px] bg-[#29366f] border border-[#5f574f] text-[#fff1e8] px-3 py-2 rounded focus:outline-none focus:border-[#ffa300]"
        >
          <option value="">{t('chooseDatePlaceholder')}</option>
          {availableDates.map((date) => (
            <option key={date} value={date}>
              {date}
            </option>
          ))}
        </select>
      </div>

      {/* Loading / Error */}
      {loading && (
        <div className="text-center py-8">
          <span className="font-pixel text-xs text-[#c2c3c7] animate-pulse">{t('loading')}</span>
        </div>
      )}

      {error && (
        <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-4 text-center">
          <span className="font-pixel text-xs text-red-400">{error}</span>
        </div>
      )}

      {/* Replay Controls */}
      {replayData && !loading && (
        <>
          {!replayData.hasData ? (
            <div className="bg-[#1d2b53] border border-[#5f574f] rounded-lg p-8 text-center">
              <span className="font-pixel text-xs text-[#83769c]">{t('noDataForDate')}</span>
            </div>
          ) : (
            <>
              {/* Time Control Panel */}
              <div className="bg-[#1d2b53] border border-[#5f574f] rounded-lg p-4">
                {/* Current Time Display */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-2xl text-[#ffa300]">
                      {formatTime(currentTime.hour, currentTime.minute)}
                    </span>
                    <span className="font-pixel text-[8px] text-[#83769c]">
                      {selectedDate}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-pixel text-[8px] text-[#c2c3c7]">{t('speed')}:</span>
                    {speeds.map((s) => (
                      <button
                        key={s}
                        onClick={() => setSpeed(s)}
                        className={`px-2 py-1 rounded font-pixel text-[8px] transition-colors ${
                          speed === s
                            ? 'bg-[#ffa300] text-black'
                            : 'bg-[#29366f] text-[#c2c3c7] hover:bg-[#3a4a8f]'
                        }`}
                      >
                        {s}x
                      </button>
                    ))}
                  </div>
                </div>

                {/* Play/Pause Controls */}
                <div className="flex items-center gap-2 mb-3">
                  <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="px-4 py-2 rounded font-pixel text-[10px] bg-[#29adff] text-white hover:bg-[#3abfff] transition-colors"
                  >
                    {isPlaying ? '⏸ ' + t('pause') : '▶ ' + t('play')}
                  </button>
                  <button
                    onClick={() => {
                      setIsPlaying(false);
                      setCurrentTime({ hour: 0, minute: 0 });
                    }}
                    className="px-3 py-2 rounded font-pixel text-[10px] bg-[#29366f] text-[#c2c3c7] hover:bg-[#3a4a8f] transition-colors"
                  >
                    ⏮ {t('reset')}
                  </button>
                </div>

                {/* Time Presets */}
                <div className="flex gap-2">
                  {timePresets.map((preset) => (
                    <button
                      key={preset.hour}
                      onClick={() => {
                        setIsPlaying(false);
                        setCurrentTime({ hour: preset.hour, minute: 0 });
                      }}
                      className="px-2 py-1 rounded font-pixel text-[8px] bg-[#29366f] text-[#c2c3c7] hover:bg-[#3a4a8f] transition-colors"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                {/* Progress Bar */}
                <div className="mt-3">
                  <div className="h-2 bg-[#29366f] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#ffa300] transition-all duration-200"
                      style={{
                        width: `${((currentTime.hour * 60 + currentTime.minute) / (24 * 60)) * 100}%`,
                      }}
                    />
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="font-pixel text-[6px] text-[#5f574f]">00:00</span>
                    <span className="font-pixel text-[6px] text-[#5f574f]">24:00</span>
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-[#1d2b53] border border-[#5f574f] rounded p-3 text-center">
                  <div className="font-pixel text-lg text-[#ffa300]">{replayData.events.length}</div>
                  <div className="font-pixel text-[8px] text-[#83769c]">{t('events')}</div>
                </div>
                <div className="bg-[#1d2b53] border border-[#5f574f] rounded p-3 text-center">
                  <div className="font-pixel text-lg text-[#29adff]">{replayData.moments.length}</div>
                  <div className="font-pixel text-[8px] text-[#83769c]">{t('moments')}</div>
                </div>
                <div className="bg-[#1d2b53] border border-[#5f574f] rounded p-3 text-center">
                  <div className="font-pixel text-lg text-[#00e436]">{replayData.agents.length}</div>
                  <div className="font-pixel text-[8px] text-[#83769c]">{t('agents')}</div>
                </div>
              </div>

              {/* Timeline Feed */}
              <div
                ref={timelineRef}
                className="bg-[#1d2b53] border border-[#5f574f] rounded-lg p-4 max-h-[400px] overflow-y-auto"
              >
                {visibleItems.length === 0 ? (
                  <div className="text-center py-8">
                    <span className="font-pixel text-[10px] text-[#83769c]">
                      {t('noEventsYet')}
                    </span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {visibleItems.map((item) => (
                      <div
                        key={`${item.type}-${item.data.id}`}
                        className={`rounded p-3 transition-all duration-300 animate-fadeIn ${
                          item.type === 'moment'
                            ? 'bg-[#29adff]/10 border border-[#29adff]/30'
                            : 'bg-[#29366f]/50 border border-[#5f574f]/50'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {/* Icon */}
                          <span className="text-lg flex-shrink-0">
                            {item.type === 'moment'
                              ? EMOTION_MAP[(item.data as ReplayMoment).emotion?.toLowerCase() ?? ''] || '💭'
                              : (item.data as ReplayEvent).icon}
                          </span>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-pixel text-[10px] text-[#ffa300]">
                                {item.type === 'moment'
                                  ? (item.data as ReplayMoment).agent_name
                                  : (item.data as ReplayEvent).agent_name}
                              </span>
                              {item.type === 'event' && (
                                <span className="font-pixel text-[8px] text-[#83769c]">
                                  {(item.data as ReplayEvent).agent_role}
                                </span>
                              )}
                              <span className="font-pixel text-[8px] text-[#5f574f] ml-auto">
                                {formatTime(item.hour, item.minute)}
                              </span>
                            </div>

                            <p className="font-pixel text-[10px] text-[#c2c3c7] leading-relaxed">
                              {item.type === 'moment'
                                ? (item.data as ReplayMoment).content
                                : (item.data as ReplayEvent).summary}
                            </p>

                            {/* Type badge */}
                            <div className="mt-2">
                              <span
                                className={`font-pixel text-[8px] px-2 py-0.5 rounded ${
                                  item.type === 'moment'
                                    ? 'text-[#29adff] bg-[#29adff]/10'
                                    : 'text-[#ffa300] bg-[#ffa300]/10'
                                }`}
                              >
                                {item.type === 'moment' ? t('socialPost') : (item.data as ReplayEvent).event_type}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}

      {/* Initial state */}
      {!selectedDate && !loading && (
        <div className="bg-[#1d2b53] border border-[#5f574f] rounded-lg p-8 text-center">
          <div className="text-4xl mb-4">📅</div>
          <p className="font-pixel text-xs text-[#83769c]">{t('selectDatePrompt')}</p>
        </div>
      )}
    </div>
  );
}
