import Phaser from 'phaser';
import { gameConfig } from './config';

let gameInstance: Phaser.Game | null = null;

export function initGame(containerId?: string): Phaser.Game {
  if (gameInstance) {
    return gameInstance;
  }

  const config: Phaser.Types.Core.GameConfig = {
    ...gameConfig,
    parent: containerId || gameConfig.parent,
  };

  gameInstance = new Phaser.Game(config);
  return gameInstance;
}

export function destroyGame(): void {
  if (gameInstance) {
    gameInstance.destroy(true);
    gameInstance = null;
  }
}

export function getGame(): Phaser.Game | null {
  return gameInstance;
}
