import Phaser from 'phaser';
import { generateTileset, TILE_SIZE } from '../tiles/tileset-generator';
import { OFFICE_MAP } from '../maps/office-map';
import { PICO8_COLORS } from '../tiles/palette';
import { AgentSprite, Direction } from '../sprites';

export class OfficeScene extends Phaser.Scene {
  private collisionLayer: number[][] = [];
  private testAgents: AgentSprite[] = [];

  constructor() {
    super({ key: 'OfficeScene' });
  }

  preload(): void {
    // Generate tileset texture programmatically
    generateTileset(this);
  }

  create(): void {
    const { width, height, layers, locations } = OFFICE_MAP;
    const mapWidth = width * TILE_SIZE;
    const mapHeight = height * TILE_SIZE;

    // Store collision data
    this.collisionLayer = layers.collision;

    // Render ground layer
    this.renderLayer(layers.ground, 0);

    // Render furniture layer
    this.renderLayer(layers.furniture, 1);

    // Draw collision debug overlay (can be toggled)
    this.renderCollisionDebug(false);

    // Add location markers for debugging
    this.addLocationMarkers(locations);

    // Add title
    this.add.text(mapWidth / 2, 16, 'Agent Town Office', {
      fontSize: '16px',
      color: '#ffffff',
      fontFamily: 'monospace',
      backgroundColor: '#1d2b53',
      padding: { x: 8, y: 4 },
    }).setOrigin(0.5, 0).setDepth(100);

    // Set camera bounds
    this.cameras.main.setBounds(0, 0, mapWidth, mapHeight);

    // Create test agents to demonstrate sprite system
    this.createTestAgents(locations);
  }

  private createTestAgents(locations: typeof OFFICE_MAP.locations): void {
    // Create agents at different workstations
    const agentConfigs = [
      { id: 'agent-alice', x: 4, y: 4, state: 'work' as const },
      { id: 'agent-bob', x: 7, y: 4, state: 'think' as const },
      { id: 'agent-charlie', x: 10, y: 4, state: 'error' as const },
      { id: 'agent-diana', x: 13, y: 8, state: 'rest' as const },
      { id: 'agent-eve', x: 4, y: 8, state: 'idle_down' as const },
    ];

    agentConfigs.forEach(config => {
      const agent = new AgentSprite(
        this,
        config.x * TILE_SIZE + TILE_SIZE / 2,
        (config.y + 1) * TILE_SIZE, // +1 because sprite origin is bottom
        config.id
      );

      // Set initial state
      switch (config.state) {
        case 'work':
          agent.work();
          break;
        case 'think':
          agent.think();
          break;
        case 'error':
          agent.error();
          break;
        case 'rest':
          agent.rest();
          break;
        default:
          agent.idle();
      }

      this.testAgents.push(agent);
    });

    // Create a walking agent demo
    const walkingAgent = new AgentSprite(
      this,
      locations.entrance.x * TILE_SIZE + TILE_SIZE / 2,
      (locations.entrance.y + 1) * TILE_SIZE,
      'agent-walker'
    );
    walkingAgent.walk('right');
    this.testAgents.push(walkingAgent);

    // Animate the walking agent
    this.tweens.add({
      targets: walkingAgent,
      x: walkingAgent.x + TILE_SIZE * 4,
      duration: 2000,
      ease: 'Linear',
      yoyo: true,
      repeat: -1,
      onYoyo: () => {
        walkingAgent.walk('left');
      },
      onRepeat: () => {
        walkingAgent.walk('right');
      },
    });
  }

  private renderLayer(layerData: number[][], depth: number): void {
    for (let y = 0; y < layerData.length; y++) {
      for (let x = 0; x < layerData[y].length; x++) {
        const tileIndex = layerData[y][x];
        if (tileIndex < 0) continue; // Skip empty tiles

        this.drawTile(x, y, tileIndex, depth);
      }
    }
  }

  private drawTile(tileX: number, tileY: number, tileIndex: number, depth: number): void {
    const graphics = this.add.graphics();
    graphics.setDepth(depth);
    
    const x = tileX * TILE_SIZE;
    const y = tileY * TILE_SIZE;

    // Draw based on tile index
    switch (tileIndex) {
      // Floor tiles
      case 0: // Light floor
        graphics.fillStyle(PICO8_COLORS.lightGray);
        graphics.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        graphics.fillStyle(PICO8_COLORS.white);
        graphics.fillRect(x + 2, y + 2, 4, 4);
        break;
      case 1: // Dark floor
        graphics.fillStyle(PICO8_COLORS.darkGray);
        graphics.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        break;
      case 2: // Carpet
        graphics.fillStyle(PICO8_COLORS.darkBlue);
        graphics.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        graphics.fillStyle(PICO8_COLORS.lavender);
        for (let i = 0; i < 4; i++) {
          graphics.fillRect(x + 4 + i * 8, y + 4, 2, 2);
          graphics.fillRect(x + 8 + i * 8, y + 20, 2, 2);
        }
        break;

      // Wall tiles
      case 10: // Wall top
        graphics.fillStyle(PICO8_COLORS.darkPurple);
        graphics.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        graphics.fillStyle(PICO8_COLORS.lavender);
        graphics.fillRect(x, y + TILE_SIZE - 4, TILE_SIZE, 4);
        break;
      case 11: // Wall bottom
        graphics.fillStyle(PICO8_COLORS.darkPurple);
        graphics.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        graphics.fillStyle(PICO8_COLORS.lavender);
        graphics.fillRect(x, y, TILE_SIZE, 4);
        break;
      case 12: // Wall left
        graphics.fillStyle(PICO8_COLORS.darkPurple);
        graphics.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        graphics.fillStyle(PICO8_COLORS.lavender);
        graphics.fillRect(x + TILE_SIZE - 4, y, 4, TILE_SIZE);
        break;
      case 13: // Wall right
        graphics.fillStyle(PICO8_COLORS.darkPurple);
        graphics.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        graphics.fillStyle(PICO8_COLORS.lavender);
        graphics.fillRect(x, y, 4, TILE_SIZE);
        break;

      // Furniture
      case 20: // Desk
        graphics.fillStyle(PICO8_COLORS.brown);
        graphics.fillRect(x + 2, y + 8, TILE_SIZE - 4, TILE_SIZE - 12);
        graphics.fillStyle(PICO8_COLORS.darkGray);
        graphics.fillRect(x + 4, y + TILE_SIZE - 6, 4, 6);
        graphics.fillRect(x + TILE_SIZE - 8, y + TILE_SIZE - 6, 4, 6);
        break;
      case 24: // Chair
        graphics.fillStyle(PICO8_COLORS.blue);
        graphics.fillRect(x + 8, y + 8, 16, 16);
        graphics.fillStyle(PICO8_COLORS.darkBlue);
        graphics.fillRect(x + 10, y + 2, 12, 8);
        break;
      case 28: // Computer
        graphics.fillStyle(PICO8_COLORS.darkGray);
        graphics.fillRect(x + 8, y + 16, 16, 12);
        graphics.fillStyle(PICO8_COLORS.black);
        graphics.fillRect(x + 6, y + 4, 20, 14);
        graphics.fillStyle(PICO8_COLORS.darkBlue);
        graphics.fillRect(x + 8, y + 6, 16, 10);
        graphics.fillStyle(PICO8_COLORS.green);
        graphics.fillRect(x + 10, y + 8, 4, 2);
        break;

      // Coffee area
      case 40: // Coffee machine
        graphics.fillStyle(PICO8_COLORS.darkGray);
        graphics.fillRect(x + 4, y + 4, 24, 24);
        graphics.fillStyle(PICO8_COLORS.black);
        graphics.fillRect(x + 8, y + 8, 16, 12);
        graphics.fillStyle(PICO8_COLORS.red);
        graphics.fillRect(x + 20, y + 22, 4, 4);
        graphics.fillStyle(PICO8_COLORS.brown);
        graphics.fillRect(x + 10, y + 22, 8, 6);
        break;
      case 41: // Counter
        graphics.fillStyle(PICO8_COLORS.brown);
        graphics.fillRect(x, y + 8, TILE_SIZE, TILE_SIZE - 8);
        graphics.fillStyle(PICO8_COLORS.lightGray);
        graphics.fillRect(x, y + 8, TILE_SIZE, 4);
        break;
      case 44: // Plant
        graphics.fillStyle(PICO8_COLORS.brown);
        graphics.fillRect(x + 10, y + 20, 12, 10);
        graphics.fillStyle(PICO8_COLORS.darkGreen);
        graphics.fillRect(x + 8, y + 8, 16, 14);
        graphics.fillStyle(PICO8_COLORS.green);
        graphics.fillRect(x + 12, y + 4, 8, 8);
        break;

      // Meeting room
      case 50: // Meeting table
        graphics.fillStyle(PICO8_COLORS.brown);
        graphics.fillRect(x, y + 4, TILE_SIZE, TILE_SIZE - 4);
        graphics.fillStyle(PICO8_COLORS.orange);
        graphics.fillRect(x + 2, y + 6, TILE_SIZE - 4, TILE_SIZE - 8);
        break;
      case 54: // Whiteboard
        graphics.fillStyle(PICO8_COLORS.darkGray);
        graphics.fillRect(x + 4, y + 2, 24, 28);
        graphics.fillStyle(PICO8_COLORS.white);
        graphics.fillRect(x + 6, y + 4, 20, 22);
        graphics.fillStyle(PICO8_COLORS.blue);
        graphics.fillRect(x + 8, y + 8, 12, 2);
        graphics.fillStyle(PICO8_COLORS.red);
        graphics.fillRect(x + 8, y + 14, 8, 2);
        break;

      // Decorations
      case 60: // Door
        graphics.fillStyle(PICO8_COLORS.brown);
        graphics.fillRect(x + 4, y, 24, TILE_SIZE);
        graphics.fillStyle(PICO8_COLORS.orange);
        graphics.fillRect(x + 8, y + 4, 16, 24);
        graphics.fillStyle(PICO8_COLORS.yellow);
        graphics.fillRect(x + 20, y + 16, 4, 4);
        break;
    }
  }

  private renderCollisionDebug(show: boolean): void {
    if (!show) return;

    const graphics = this.add.graphics();
    graphics.setDepth(50);
    graphics.setAlpha(0.3);

    for (let y = 0; y < this.collisionLayer.length; y++) {
      for (let x = 0; x < this.collisionLayer[y].length; x++) {
        if (this.collisionLayer[y][x] === 1) {
          graphics.fillStyle(PICO8_COLORS.red);
          graphics.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        }
      }
    }
  }

  private addLocationMarkers(locations: typeof OFFICE_MAP.locations): void {
    // Entrance marker
    const entrance = locations.entrance;
    this.add.circle(
      entrance.x * TILE_SIZE + TILE_SIZE / 2,
      entrance.y * TILE_SIZE + TILE_SIZE / 2,
      8,
      PICO8_COLORS.green
    ).setDepth(10).setAlpha(0.7);
  }

  // Public method to check collision at tile coordinates
  public isColliding(tileX: number, tileY: number): boolean {
    if (
      tileY < 0 || tileY >= this.collisionLayer.length ||
      tileX < 0 || tileX >= this.collisionLayer[0].length
    ) {
      return true; // Out of bounds = collision
    }
    return this.collisionLayer[tileY][tileX] === 1;
  }

  update(): void {
    // Update agent depths for proper layering
    this.testAgents.forEach(agent => agent.updateDepth());
  }
}
