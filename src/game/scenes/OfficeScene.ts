import Phaser from 'phaser';

export class OfficeScene extends Phaser.Scene {
  constructor() {
    super({ key: 'OfficeScene' });
  }

  preload(): void {
    // Assets will be loaded here in future issues
  }

  create(): void {
    // Draw a simple pixel block to verify rendering
    const graphics = this.add.graphics();
    
    // Floor grid pattern
    graphics.fillStyle(0x2d2d44, 1);
    for (let x = 0; x < 800; x += 32) {
      for (let y = 0; y < 600; y += 32) {
        if ((x / 32 + y / 32) % 2 === 0) {
          graphics.fillRect(x, y, 32, 32);
        }
      }
    }

    // Test pixel block (agent placeholder)
    const testBlock = this.add.graphics();
    testBlock.fillStyle(0x4ecdc4, 1);
    testBlock.fillRect(0, 0, 32, 32);
    testBlock.setPosition(400 - 16, 300 - 16);

    // Add text label
    this.add.text(400, 50, 'Agent Town - Office', {
      fontSize: '24px',
      color: '#ffffff',
      fontFamily: 'monospace',
    }).setOrigin(0.5);

    this.add.text(400, 550, 'Phaser.js Integration Test', {
      fontSize: '14px',
      color: '#888888',
      fontFamily: 'monospace',
    }).setOrigin(0.5);
  }

  update(): void {
    // Game loop logic will be added in future issues
  }
}
