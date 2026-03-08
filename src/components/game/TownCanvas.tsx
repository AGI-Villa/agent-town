'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Phaser from 'phaser';
import type { AgentStatus } from '@/lib/types';
import { TOWN_MAP, TownArea } from '@/game/maps/town-map';

// Inline AgentDetailModal to avoid import issues
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70" />
      <div className="relative w-full max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="border-4 border-[#5f574f] bg-[#1d2b53]">
          <div className="border-b-2 border-[#5f574f] bg-[#29366f] px-4 py-3 flex justify-between">
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
              <span className="font-pixel text-[10px] text-[#c2c3c7]">LAST:</span>
              <span className="font-pixel text-xs text-[#fff1e8]">{formatTimeAgo(agent.last_event_at)}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-pixel text-[10px] text-[#c2c3c7]">24H:</span>
              <span className="font-pixel text-xs text-[#29adff]">{agent.event_count_24h}</span>
            </div>
          </div>
          <div className="border-t-2 border-[#5f574f] px-4 py-3">
            <button onClick={onClose} className="w-full font-pixel text-xs text-[#c2c3c7] border-2 border-[#5f574f] py-2">
              CLOSE
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface TownCanvasProps {
  className?: string;
}

const AREA_COLORS: Record<string, string> = {
  office: '#1d2b53',
  park: '#008751',
  residential: '#ab5236',
  coffeeShop: '#7e2553',
  store: '#5f574f',
};

export default function TownCanvas({ className }: TownCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<AgentStatus | null>(null);
  const [currentArea, setCurrentArea] = useState<TownArea>('office');

  const handleAgentClick = useCallback(async (agentId: string) => {
    try {
      const res = await fetch('/api/agents');
      if (!res.ok) return;
      const agents: AgentStatus[] = await res.json();
      const agent = agents.find(a => a.agent_id === agentId);
      if (agent) {
        setSelectedAgent(agent);
      }
    } catch (err) {
      console.error('Failed to fetch agent details:', err);
    }
  }, []);

  const handleAreaChange = useCallback((area: TownArea) => {
    setCurrentArea(area);
  }, []);

  const navigateToArea = useCallback((areaName: string) => {
    const game = gameRef.current;
    if (!game) return;
    
    const scene = game.scene.getScene('TownScene') as any;
    if (scene && scene.navigateToArea) {
      scene.navigateToArea(areaName as TownArea);
    }
  }, []);

  useEffect(() => {
    const initializeGame = async () => {
      if (typeof window === 'undefined' || gameRef.current) return;

      const { TownScene, setTownCallbacks } = await import('@/game/scenes/TownScene');
      const Phaser = (await import('phaser')).default;
      
      // Set up callbacks
      setTownCallbacks({
        onAgentClick: handleAgentClick,
        onAreaChange: handleAreaChange,
      });
      
      const config: Phaser.Types.Core.GameConfig = {
        type: Phaser.AUTO,
        width: 800,
        height: 600,
        pixelArt: true,
        roundPixels: true,
        backgroundColor: '#1a1a2e',
        parent: 'town-container',
        scene: [TownScene],
        scale: {
          mode: Phaser.Scale.FIT,
          autoCenter: Phaser.Scale.CENTER_BOTH,
        },
      };

      if (containerRef.current) {
        gameRef.current = new Phaser.Game(config);
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

    return () => {
      cleanup.then((cleanupFn) => cleanupFn?.());
    };
  }, [handleAgentClick, handleAreaChange]);

  return (
    <div className="flex gap-4">
      <div className="flex-1">
        <div
          id="town-container"
          ref={containerRef}
          className={className}
          style={{
            width: '100%',
            maxWidth: '800px',
            aspectRatio: '4/3',
          }}
        />
        <div className="mt-2 flex gap-2 flex-wrap">
          {Object.entries(TOWN_MAP.areas).map(([name, area]) => (
            <button
              key={name}
              onClick={() => navigateToArea(name)}
              className={`font-pixel text-[10px] px-3 py-2 border-2 transition-colors ${
                currentArea === name
                  ? 'border-[#ffa300] text-[#ffa300] bg-[#ffa300]/10'
                  : 'border-[#5f574f] text-[#83769c] hover:text-[#fff1e8] hover:border-[#fff1e8]'
              }`}
            >
              {area.name.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      
      
      {/* Minimap - inline simple version */}
      <div className="hidden lg:block border-2 border-[#5f574f] bg-[#1d2b53] p-2">
        <div className="font-pixel text-[8px] text-[#c2c3c7] mb-2">MAP</div>
        <div className="flex flex-wrap gap-1">
          {Object.entries(TOWN_MAP.areas).map(([name, area]) => (
            <button
              key={name}
              onClick={() => navigateToArea(name)}
              className="font-pixel text-[8px] text-[#83769c] hover:text-[#fff1e8]"
              style={{ 
                backgroundColor: AREA_COLORS[name],
                padding: '4px 8px',
              }}
            >
              {area.name.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <AgentDetailModal
        agent={selectedAgent}
        onClose={() => setSelectedAgent(null)}
      />
    </div>
  );
}
