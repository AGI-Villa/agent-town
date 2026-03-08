import Phaser from 'phaser';
import { PICO8_COLORS } from './palette';

const TILE_SIZE = 32;

// Generate tileset texture programmatically
export function generateTileset(scene: Phaser.Scene): void {
  const graphics = scene.make.graphics({ x: 0, y: 0 });
  const tilesPerRow = 10;
  const rows = 8;
  const width = tilesPerRow * TILE_SIZE;
  const height = rows * TILE_SIZE;

  // Clear with transparent
  graphics.clear();

  // Helper to draw at tile position
  const drawAt = (tileX: number, tileY: number, drawFn: () => void) => {
    graphics.save();
    graphics.translateCanvas(tileX * TILE_SIZE, tileY * TILE_SIZE);
    drawFn();
    graphics.restore();
  };

  // Tile 0: Light floor
  drawAt(0, 0, () => {
    graphics.fillStyle(PICO8_COLORS.lightGray);
    graphics.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
    graphics.fillStyle(PICO8_COLORS.white);
    graphics.fillRect(2, 2, 4, 4);
  });

  // Tile 1: Dark floor
  drawAt(1, 0, () => {
    graphics.fillStyle(PICO8_COLORS.darkGray);
    graphics.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
  });

  // Tile 2: Carpet
  drawAt(2, 0, () => {
    graphics.fillStyle(PICO8_COLORS.darkBlue);
    graphics.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
    graphics.fillStyle(PICO8_COLORS.lavender);
    for (let i = 0; i < 4; i++) {
      graphics.fillRect(4 + i * 8, 4, 2, 2);
      graphics.fillRect(8 + i * 8, 20, 2, 2);
    }
  });

  // Tile 10: Wall top
  drawAt(0, 1, () => {
    graphics.fillStyle(PICO8_COLORS.darkPurple);
    graphics.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
    graphics.fillStyle(PICO8_COLORS.lavender);
    graphics.fillRect(0, TILE_SIZE - 4, TILE_SIZE, 4);
  });

  // Tile 11: Wall bottom
  drawAt(1, 1, () => {
    graphics.fillStyle(PICO8_COLORS.darkPurple);
    graphics.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
    graphics.fillStyle(PICO8_COLORS.lavender);
    graphics.fillRect(0, 0, TILE_SIZE, 4);
  });

  // Tile 20: Desk (simple)
  drawAt(0, 2, () => {
    graphics.fillStyle(PICO8_COLORS.brown);
    graphics.fillRect(2, 8, TILE_SIZE - 4, TILE_SIZE - 12);
    graphics.fillStyle(PICO8_COLORS.darkGray);
    graphics.fillRect(4, TILE_SIZE - 6, 4, 6);
    graphics.fillRect(TILE_SIZE - 8, TILE_SIZE - 6, 4, 6);
  });

  // Tile 24: Chair
  drawAt(4, 2, () => {
    graphics.fillStyle(PICO8_COLORS.blue);
    graphics.fillRect(8, 8, 16, 16);
    graphics.fillStyle(PICO8_COLORS.darkBlue);
    graphics.fillRect(10, 2, 12, 8);
  });

  // Tile 28: Computer
  drawAt(8, 2, () => {
    graphics.fillStyle(PICO8_COLORS.darkGray);
    graphics.fillRect(8, 16, 16, 12);
    graphics.fillStyle(PICO8_COLORS.black);
    graphics.fillRect(6, 4, 20, 14);
    graphics.fillStyle(PICO8_COLORS.darkBlue);
    graphics.fillRect(8, 6, 16, 10);
    graphics.fillStyle(PICO8_COLORS.green);
    graphics.fillRect(10, 8, 4, 2);
  });

  // Tile 40: Coffee machine
  drawAt(0, 4, () => {
    graphics.fillStyle(PICO8_COLORS.darkGray);
    graphics.fillRect(4, 4, 24, 24);
    graphics.fillStyle(PICO8_COLORS.black);
    graphics.fillRect(8, 8, 16, 12);
    graphics.fillStyle(PICO8_COLORS.red);
    graphics.fillRect(20, 22, 4, 4);
    graphics.fillStyle(PICO8_COLORS.brown);
    graphics.fillRect(10, 22, 8, 6);
  });

  // Tile 44: Plant
  drawAt(4, 4, () => {
    graphics.fillStyle(PICO8_COLORS.brown);
    graphics.fillRect(10, 20, 12, 10);
    graphics.fillStyle(PICO8_COLORS.darkGreen);
    graphics.fillRect(8, 8, 16, 14);
    graphics.fillStyle(PICO8_COLORS.green);
    graphics.fillRect(12, 4, 8, 8);
  });

  // Tile 50: Meeting table
  drawAt(0, 5, () => {
    graphics.fillStyle(PICO8_COLORS.brown);
    graphics.fillRect(0, 8, TILE_SIZE, TILE_SIZE - 8);
  });

  // Tile 54: Whiteboard
  drawAt(4, 5, () => {
    graphics.fillStyle(PICO8_COLORS.darkGray);
    graphics.fillRect(4, 2, 24, 28);
    graphics.fillStyle(PICO8_COLORS.white);
    graphics.fillRect(6, 4, 20, 22);
    graphics.fillStyle(PICO8_COLORS.blue);
    graphics.fillRect(8, 8, 12, 2);
    graphics.fillStyle(PICO8_COLORS.red);
    graphics.fillRect(8, 14, 8, 2);
  });

  // Tile 60: Door
  drawAt(0, 6, () => {
    graphics.fillStyle(PICO8_COLORS.brown);
    graphics.fillRect(4, 0, 24, TILE_SIZE);
    graphics.fillStyle(PICO8_COLORS.orange);
    graphics.fillRect(8, 4, 16, 24);
    graphics.fillStyle(PICO8_COLORS.yellow);
    graphics.fillRect(20, 16, 4, 4);
  });

  // Tile 61: Window
  drawAt(1, 6, () => {
    graphics.fillStyle(PICO8_COLORS.darkGray);
    graphics.fillRect(2, 4, 28, 24);
    graphics.fillStyle(PICO8_COLORS.blue);
    graphics.fillRect(4, 6, 11, 20);
    graphics.fillRect(17, 6, 11, 20);
  });

  // Generate texture from graphics
  graphics.generateTexture('office-tileset', width, height);
  graphics.destroy();
}

export { TILE_SIZE };
