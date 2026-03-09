'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Phaser from 'phaser';
import AgentListPanel from './AgentListPanel';
import { AgentDetailPanel } from './AgentDetailPanel';

interface TownCanvasProps {
  initialArea?: string;
}

export default function TownCanvas({ initialArea }: TownCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  const handleAgentClick = useCallback((agentId: string) => {
    setSelectedAgentId(agentId);
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
    // Show detail panel
    setSelectedAgentId(agentId);
  }, []);

  return (
    <>
      <div
        id="town-container"
        ref={containerRef}
        className="w-full h-full"
      />
      <AgentListPanel onAgentSelect={handleAgentSelect} />
      <AgentDetailPanel
        agentId={selectedAgentId}
        onClose={() => setSelectedAgentId(null)}
      />
    </>
  );
}
