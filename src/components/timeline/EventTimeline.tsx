'use client';

import { useEffect, useState, useCallback, useRef } from 'react';

interface TimelineEvent {
  id: string;
  agent_id: string;
  agent_name: string;
  agent_role: string;
  event_type: string;
  icon: string;
  summary: string;
  time: string;
  created_at: string;
}

interface AgentOption {
  id: string;
  name: string;
}

type DateFilter = 'today' | 'yesterday' | 'week' | 'all';

export function EventTimeline() {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<DateFilter>('today');
  const offsetRef = useRef(0);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const fetchEvents = useCallback(async (reset = false) => {
    if (reset) {
      offsetRef.current = 0;
      setEvents([]);
    }

    const offset = offsetRef.current;
    const params = new URLSearchParams();
    if (selectedAgent) params.set('agent_id', selectedAgent);
    if (dateFilter !== 'all') params.set('date', dateFilter);
    params.set('offset', String(offset));
    params.set('limit', '20');

    try {
      const res = await fetch(`/api/events?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();

      if (reset) {
        setEvents(data.events);
        setAgents(data.agents);
      } else {
        setEvents((prev) => [...prev, ...data.events]);
      }

      setHasMore(data.hasMore);
      offsetRef.current = offset + data.events.length;
    } catch (err) {
      console.error('Failed to fetch events:', err);
    }
  }, [selectedAgent, dateFilter]);

  // Initial load
  useEffect(() => {
    setLoading(true);
    fetchEvents(true).finally(() => setLoading(false));
  }, [selectedAgent, dateFilter]);

  // Infinite scroll
  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
          setLoadingMore(true);
          fetchEvents(false).finally(() => setLoadingMore(false));
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => observerRef.current?.disconnect();
  }, [hasMore, loading, loadingMore, fetchEvents]);

  const dateFilters: { key: DateFilter; label: string }[] = [
    { key: 'today', label: '今天' },
    { key: 'yesterday', label: '昨天' },
    { key: 'week', label: '本周' },
    { key: 'all', label: '全部' },
  ];

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Date filter */}
        <div className="flex gap-1 bg-[#1d2b53] border border-[#5f574f] rounded p-1">
          {dateFilters.map((f) => (
            <button
              key={f.key}
              onClick={() => setDateFilter(f.key)}
              className={`font-pixel text-[10px] px-3 py-1.5 rounded transition-colors ${
                dateFilter === f.key
                  ? 'bg-[#29366f] text-[#ffa300]'
                  : 'text-[#c2c3c7] hover:text-[#fff1e8]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Agent filter */}
        <select
          value={selectedAgent}
          onChange={(e) => setSelectedAgent(e.target.value)}
          className="font-pixel text-[10px] bg-[#1d2b53] border border-[#5f574f] text-[#c2c3c7] px-3 py-2 rounded focus:outline-none focus:border-[#ffa300]"
        >
          <option value="">全部 Agent</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>

      {/* Event list */}
      {loading ? (
        <div className="text-center py-8">
          <span className="font-pixel text-xs text-[#c2c3c7] animate-pulse">加载中...</span>
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-8 bg-[#1d2b53] border border-[#5f574f] rounded">
          <span className="font-pixel text-xs text-[#83769c]">暂无事件</span>
        </div>
      ) : (
        <div className="space-y-2">
          {events.map((event) => (
            <div
              key={event.id}
              className="bg-[#1d2b53] border border-[#5f574f] rounded p-3 hover:border-[#ffa300]/50 transition-colors"
            >
              <div className="flex items-start gap-3">
                {/* Icon */}
                <span className="text-lg flex-shrink-0">{event.icon}</span>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  {/* Header */}
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-pixel text-[10px] text-[#ffa300]">
                      {event.agent_name}
                    </span>
                    <span className="font-pixel text-[8px] text-[#83769c]">
                      {event.agent_role}
                    </span>
                    <span className="font-pixel text-[8px] text-[#5f574f] ml-auto flex-shrink-0">
                      {event.time}
                    </span>
                  </div>

                  {/* Summary */}
                  <p className="font-pixel text-[10px] text-[#c2c3c7] leading-relaxed break-words">
                    {event.summary}
                  </p>

                  {/* Event type badge */}
                  <div className="mt-2">
                    <span className="font-pixel text-[8px] text-[#29adff] bg-[#29adff]/10 px-2 py-0.5 rounded">
                      {event.event_type}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Load more trigger */}
          <div ref={loadMoreRef} className="h-4" />

          {loadingMore && (
            <div className="text-center py-4">
              <span className="font-pixel text-[10px] text-[#c2c3c7] animate-pulse">
                加载更多...
              </span>
            </div>
          )}

          {!hasMore && events.length > 0 && (
            <div className="text-center py-4">
              <span className="font-pixel text-[10px] text-[#5f574f]">
                — 没有更多了 —
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
