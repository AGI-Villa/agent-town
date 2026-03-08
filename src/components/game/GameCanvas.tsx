'use client';

import { useEffect, useRef } from 'react';

interface GameCanvasProps {
  className?: string;
}

export default function GameCanvas({ className }: GameCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    const initializeGame = async () => {
      if (typeof window === 'undefined' || gameRef.current) return;

      const { initGame, destroyGame } = await import('@/game');
      
      if (containerRef.current) {
        gameRef.current = initGame('game-container');
      }

      return () => {
        destroyGame();
        gameRef.current = null;
      };
    };

    const cleanup = initializeGame();

    return () => {
      cleanup.then((cleanupFn) => cleanupFn?.());
    };
  }, []);

  return (
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
  );
}
