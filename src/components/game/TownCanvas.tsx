'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Phaser from 'phaser';
import type { AgentStatus } from '@/lib/types';
import AgentListPanel from './AgentListPanel';

function AgentDetailModal({ agent, onClose }: { agent: AgentStatus | null; onClose: () => void }) {
  if (!agent) return null;
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return '#00e436';
      case 'idle': return '#ffec27';
      default: return '#83769c';
    }
  };
  const formatTimeAgo = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 60) return `${diffMin}m ago`;
    return `${Math.floor(diffMin / 60)}h ago`;
  };
  const formatTaskTime = (dateStr: string | null) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70" />
      <div className="relative w-full max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="border-4 border-[#5f574f] bg-[#1d2b53] rounded-lg">
          <div className="border-b-2 border-[#5f574f] bg-[#29366f] px-4 py-3 flex justify-between rounded-t-lg">
            <h2 className="font-pixel text-sm text-[#fff1e8] truncate">{agent.agent_id}</h2>
            <button onClick={onClose} className="font-pixel text-xs text-[#ff004d]">[X]</button>
          </div>
          <div className="p-4 space-y-3">
            <div className="flex items-center gap-3">
              <span className="font-pixel text-[10px] text-[#c2c3c7]">STATUS:</span>
              <span className="font-pixel text-xs" style={{ color: getStatusColor(agent.status) }}>
                {agent.status.toUpperCase()}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-pixel text-[10px] text-[#c2c3c7]">DOING:</span>
              <span className="font-pixel text-xs text-[#fff1e8]">
                {agent.current_task?.description || (agent.status === 'online' ? 'Working' : 'Resting')}
              </span>
            </div>
            {agent.current_task?.started_at && (
              <div className="flex items-center gap-3">
                <span className="font-pixel text-[10px] text-[#c2c3c7]">STARTED:</span>
                <span className="font-pixel text-xs text-[#29adff]">{formatTaskTime(agent.current_task.started_at)}</span>
              </div>
            )}
            <div className="flex items-center gap-3">
              <span className="font-pixel text-[10px] text-[#c2c3c7]">LAST:</span>
              <span className="font-pixel text-xs text-[#fff1e8]">{formatTimeAgo(agent.last_event_at)}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-pixel text-[10px] text-[#c2c3c7]">24H EVENTS:</span>
              <span className="font-pixel text-xs text-[#29adff]">{agent.event_count_24h}</span>
            </div>
          </div>
          <div className="border-t-2 border-[#5f574f] px-4 py-3">
            <button onClick={onClose} className="w-full font-pixel text-xs text-[#c2c3c7] border-2 border-[#5f574f] py-2 hover:bg-[#5f574f]/20">
              CLOSE
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface TownCanvasProps {
  initialArea?: string;
}

export default function TownCanvas({ initialArea }: TownCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<AgentStatus | null>(null);

  const handleAgentClick = useCallback(async (agentId: string) => {
    try {
      const res = await fetch('/api/agents');
      if (!res.ok) return;
      const agents: AgentStatus[] = await res.json();
      const agent = agents.find(a => a.agent_id === agentId);
      if (agent) setSelectedAgent(agent);
    } catch (err) {
      console.error('Failed to fetch agent details:', err);
    }
  }, []);

  useEffect(() => {
    const initializeGame = async () => {
      if (typeof window === 'undefined' || gameRef.current) return;

      const { TownScene, setTownCallbacks } = await import('@/game/scenes/TownScene');
      const Phaser = (await import('phaser')).default;

      setTownCallbacks({ onAgentClick: handleAgentClick });

      const config: Phaser.Types.Core.GameConfig = {
        type: Phaser.AUTO,
        pixelArt: true,
        roundPixels: true,
        backgroundColor: '#4a7c59', // Grass green to match map edges
        parent: 'town-container',
        scene: [TownScene],
        scale: {
          mode: Phaser.Scale.RESIZE,
          autoCenter: Phaser.Scale.CENTER_BOTH,
          width: '100%',
          height: '100%',
        },
      };

      if (containerRef.current) {
        gameRef.current = new Phaser.Game(config);
        if (initialArea) {
          gameRef.current.events.once('ready', () => {
            setTimeout(() => {
              const scene = gameRef.current?.scene.getScene('TownScene') as any;
              if (scene?.navigateToArea) scene.navigateToArea(initialArea);
            }, 500);
          });
        }
      }

      return () => {
        setTownCallbacks({});
        if (gameRef.current) {
          gameRef.current.destroy(true);
          gameRef.current = null;
        }
      };
    };

    const cleanup = initializeGame();
    return () => { cleanup.then((fn) => fn?.()); };
  }, [handleAgentClick]);

  const handleAgentSelect = useCallback((agentId: string) => {
    // Focus on agent in the game scene
    const scene = gameRef.current?.scene.getScene('TownScene') as any;
    if (scene?.focusOnAgent) {
      scene.focusOnAgent(agentId);
    }
    // Also fetch and show details
    handleAgentClick(agentId);
  }, [handleAgentClick]);

  return (
    <>
      <div
        id="town-container"
        ref={containerRef}
        className="w-full h-full"
      />
      <AgentListPanel onAgentSelect={handleAgentSelect} />
      <AgentDetailModal
        agent={selectedAgent}
        onClose={() => setSelectedAgent(null)}
      />
    </>
  );
}
