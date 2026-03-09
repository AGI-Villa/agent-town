import Phaser from 'phaser';
import { OfficeScene } from './scenes/OfficeScene';
import { TownScene } from './scenes/TownScene';

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  pixelArt: true,
  roundPixels: true,
  backgroundColor: '#4a7c59', // Grass green to match map edges
  parent: 'game-container',
  scene: [OfficeScene, TownScene],
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    min: {
      width: 400,
      height: 300,
    },
    max: {
      width: 1920,
      height: 1080,
    },
  },
};
