'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { AgentDetailModal } from './AgentDetailModal';
import type { AgentStatus } from '@/lib/types';

interface GameCanvasProps {
  className?: string;
}

export default function GameCanvas({ className }: GameCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<AgentStatus | null>(null);

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

  useEffect(() => {
    const initializeGame = async () => {
      if (typeof window === 'undefined' || gameRef.current) return;

      const { initGame, destroyGame } = await import('@/game');
      const { setAgentClickCallback } = await import('@/game/scenes/OfficeScene');
      
      // Set up click callback
      setAgentClickCallback(handleAgentClick);
      
      if (containerRef.current) {
        gameRef.current = initGame('game-container');
      }

      return () => {
        setAgentClickCallback(null);
        destroyGame();
        gameRef.current = null;
      };
    };

    const cleanup = initializeGame();

    return () => {
      cleanup.then((cleanupFn) => cleanupFn?.());
    };
  }, [handleAgentClick]);

  return (
    <>
      <div
        id="game-container"
        ref={containerRef}
        className={className}
        style={{
          width: '100%',
          maxWidth: '800px',
          aspectRatio: '4/3',
        }}
      />
      <AgentDetailModal
        agent={selectedAgent}
        onClose={() => setSelectedAgent(null)}
      />
    </>
  );
}
