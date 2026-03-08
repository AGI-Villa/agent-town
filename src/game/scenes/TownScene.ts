import Phaser from 'phaser';
import { TILE_SIZE } from '../tiles/tileset-generator';
import { TOWN_MAP, TownArea } from '../maps/town-map';
import { PICO8_COLORS } from '../tiles/palette';
import { AgentSprite } from '../sprites';
import { PathfindingManager, AgentMovementController } from '../pathfinding';
import { DayNightCycle, TimeOfDay, GameTimeSystem, TimeSpeed, ScheduleSystem, SocialInteractionSystem } from '../systems';
import type { AgentStatus as ApiAgentStatus } from '@/lib/types';

// Event callbacks for React integration
type AgentClickCallback = (agentId: string) => void;
type AreaChangeCallback = (area: TownArea) => void;
type ViewportChangeCallback = (x: number, y: number, w: number, h: number) => void;
type TimeChangeCallback = (hour: number, minute: number, speed: TimeSpeed) => void;

let agentClickCallback: AgentClickCallback | null = null;
let areaChangeCallback: AreaChangeCallback | null = null;
let viewportChangeCallback: ViewportChangeCallback | null = null;
let timeChangeCallback: TimeChangeCallback | null = null;

export function setTownCallbacks(callbacks: {
  onAgentClick?: AgentClickCallback | null;
  onAreaChange?: AreaChangeCallback | null;
  onViewportChange?: ViewportChangeCallback | null;
  onTimeChange?: TimeChangeCallback | null;
}): void {
  agentClickCallback = callbacks.onAgentClick ?? null;
  areaChangeCallback = callbacks.onAreaChange ?? null;
  viewportChangeCallback = callbacks.onViewportChange ?? null;
  timeChangeCallback = callbacks.onTimeChange ?? null;
}

export class TownScene extends Phaser.Scene {
  private collisionLayer: number[][] = [];
  private agents: Map<string, AgentSprite> = new Map();
  private agentData: Map<string, ApiAgentStatus> = new Map();
  private pathfinder!: PathfindingManager;
  private movementControllers: Map<string, AgentMovementController> = new Map();
  private dayNightCycle!: DayNightCycle;
  private gameTime!: GameTimeSystem;
  private scheduleSystem!: ScheduleSystem;
  private socialSystem!: SocialInteractionSystem;
  private currentArea: TownArea = 'office';
  private timeText!: Phaser.GameObjects.Text;
  private speedText!: Phaser.GameObjects.Text;
  private isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private pollTimer: number | null = null;

  constructor() {
    super({ key: 'TownScene' });
  }

  preload(): void {
    // Tileset generation handled in create
  }

  create(): void {
    const { width, height, layers } = TOWN_MAP;
    const mapWidth = width * TILE_SIZE;
    const mapHeight = height * TILE_SIZE;

    this.collisionLayer = layers.collision;
    this.pathfinder = new PathfindingManager();
    this.pathfinder.setGrid(layers.collision);

    // Render map layers
    this.renderGroundLayer(layers.ground);
    this.renderFurnitureLayer(layers.furniture);

    // Set up game time system (start at 9:00 AM)
    this.gameTime = new GameTimeSystem(this, {
      startHour: 9,
      startMinute: 0,
      speed: 1,
    });
    this.gameTime.start();

    // Set up schedule system
    this.scheduleSystem = new ScheduleSystem(this, this.gameTime, this.pathfinder);

    // Set up social interaction system
    this.socialSystem = new SocialInteractionSystem(this);
    this.socialSystem.start();

    // Set up day/night cycle synced with game time
    this.dayNightCycle = new DayNightCycle(this, {
      cycleDurationMs: 120000,
      startTime: 'day',
    });
    this.dayNightCycle.create(mapWidth, mapHeight);
    this.dayNightCycle.start();

    // Sync day/night with game time
    this.gameTime.onTimeChange((hour) => {
      if (hour >= 6 && hour < 8) {
        this.dayNightCycle.setTime('dawn');
      } else if (hour >= 8 && hour < 18) {
        this.dayNightCycle.setTime('day');
      } else if (hour >= 18 && hour < 20) {
        this.dayNightCycle.setTime('dusk');
      } else {
        this.dayNightCycle.setTime('night');
      }
      this.notifyTimeChange();
    });

    // Time display
    this.timeText = this.add.text(mapWidth - 80, 16, '09:00', {
      fontSize: '12px',
      color: '#ffffff',
      fontFamily: 'monospace',
      backgroundColor: '#1d2b53',
      padding: { x: 4, y: 2 },
    }).setDepth(101).setScrollFactor(0);

    // Speed display
    this.speedText = this.add.text(mapWidth - 80, 36, '1x', {
      fontSize: '10px',
      color: '#ffcc00',
      fontFamily: 'monospace',
      backgroundColor: '#1d2b53',
      padding: { x: 4, y: 2 },
    }).setDepth(101).setScrollFactor(0);
    this.speedText.setInteractive({ useHandCursor: true });
    this.speedText.on('pointerdown', () => this.cycleSpeed());

    // Title
    this.add.text(16, 16, 'Agent Town', {
      fontSize: '16px',
      color: '#ffffff',
      fontFamily: 'monospace',
      backgroundColor: '#1d2b53',
      padding: { x: 8, y: 4 },
    }).setDepth(100).setScrollFactor(0);

    // Camera setup
    this.cameras.main.setBounds(0, 0, mapWidth, mapHeight);
    this.cameras.main.setZoom(1);

    // Enable camera drag
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) {
        this.isDragging = true;
        this.dragStartX = pointer.x;
        this.dragStartY = pointer.y;
      }
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.isDragging) {
        const dx = this.dragStartX - pointer.x;
        const dy = this.dragStartY - pointer.y;
        this.cameras.main.scrollX += dx;
        this.cameras.main.scrollY += dy;
        this.dragStartX = pointer.x;
        this.dragStartY = pointer.y;
        this.notifyViewportChange();
      }
    });

    this.input.on('pointerup', () => {
      this.isDragging = false;
    });

    // Keyboard controls for areas
    this.input.keyboard?.on('keydown-ONE', () => this.navigateToArea('office'));
    this.input.keyboard?.on('keydown-TWO', () => this.navigateToArea('park'));
    this.input.keyboard?.on('keydown-THREE', () => this.navigateToArea('residential'));
    this.input.keyboard?.on('keydown-FOUR', () => this.navigateToArea('coffeeShop'));
    this.input.keyboard?.on('keydown-FIVE', () => this.navigateToArea('store'));

    // Keyboard controls for time speed
    this.input.keyboard?.on('keydown-COMMA', () => this.setTimeSpeed(1));
    this.input.keyboard?.on('keydown-PERIOD', () => this.setTimeSpeed(10));
    this.input.keyboard?.on('keydown-FORWARD_SLASH', () => this.setTimeSpeed(60));

    // Start polling for agents
    this.startPolling();

    // Start at office
    this.navigateToArea('office');
  }

  private cycleSpeed(): void {
    const current = this.gameTime.getSpeed();
    const speeds: TimeSpeed[] = [1, 10, 60];
    const idx = speeds.indexOf(current);
    const next = speeds[(idx + 1) % speeds.length];
    this.setTimeSpeed(next);
  }

  setTimeSpeed(speed: TimeSpeed): void {
    this.gameTime.setSpeed(speed);
    this.speedText.setText(`${speed}x`);
    this.notifyTimeChange();
  }

  getTimeSpeed(): TimeSpeed {
    return this.gameTime.getSpeed();
  }

  private notifyTimeChange(): void {
    if (timeChangeCallback) {
      timeChangeCallback(
        this.gameTime.getHour(),
        this.gameTime.getMinute(),
        this.gameTime.getSpeed()
      );
    }
  }

  private async startPolling(): Promise<void> {
    await this.fetchAndUpdateAgents();
    this.pollTimer = window.setInterval(() => {
      this.fetchAndUpdateAgents();
    }, 5000);
  }

  private async fetchAndUpdateAgents(): Promise<void> {
    try {
      const res = await fetch('/api/agents');
      if (!res.ok) return;
      const agents: ApiAgentStatus[] = await res.json();
      
      const newAgentIds = new Set(agents.map(a => a.agent_id));
      
      // Add/update agents
      for (const agent of agents) {
        if (!this.agents.has(agent.agent_id)) {
          this.createAgent(agent);
        } else {
          this.updateAgentState(agent);
        }
        this.agentData.set(agent.agent_id, agent);
      }
      
      // Remove agents no longer in list
      for (const agentId of this.agents.keys()) {
        if (!newAgentIds.has(agentId)) {
          this.removeAgent(agentId);
        }
      }
    } catch (err) {
      console.error('Failed to fetch agents:', err);
    }
  }

  private renderGroundLayer(layerData: number[][]): void {
    for (let y = 0; y < layerData.length; y++) {
      for (let x = 0; x < layerData[y].length; x++) {
        const tileIndex = layerData[y][x];
        this.drawGroundTile(x, y, tileIndex);
      }
    }
  }

  private drawGroundTile(tileX: number, tileY: number, tileIndex: number): void {
    const graphics = this.add.graphics();
    graphics.setDepth(0);
    const x = tileX * TILE_SIZE;
    const y = tileY * TILE_SIZE;

    switch (tileIndex) {
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
        break;
      case 3: // Grass
        graphics.fillStyle(PICO8_COLORS.darkGreen);
        graphics.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        graphics.fillStyle(PICO8_COLORS.green);
        graphics.fillRect(x + 4, y + 8, 2, 4);
        graphics.fillRect(x + 20, y + 16, 2, 4);
        graphics.fillRect(x + 12, y + 24, 2, 4);
        break;
      case 4: // Road
        graphics.fillStyle(PICO8_COLORS.darkGray);
        graphics.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        graphics.fillStyle(PICO8_COLORS.yellow);
        graphics.fillRect(x + 14, y + 14, 4, 4);
        break;
      case 5: // Wooden floor
        graphics.fillStyle(PICO8_COLORS.brown);
        graphics.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        graphics.fillStyle(PICO8_COLORS.orange);
        graphics.fillRect(x, y + 8, TILE_SIZE, 2);
        graphics.fillRect(x, y + 24, TILE_SIZE, 2);
        break;
      case 6: // Tile floor
        graphics.fillStyle(PICO8_COLORS.lightGray);
        graphics.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        graphics.fillStyle(PICO8_COLORS.white);
        graphics.fillRect(x, y, 16, 16);
        graphics.fillRect(x + 16, y + 16, 16, 16);
        break;
      default:
        graphics.fillStyle(PICO8_COLORS.black);
        graphics.fillRect(x, y, TILE_SIZE, TILE_SIZE);
    }
  }

  private renderFurnitureLayer(layerData: number[][]): void {
    for (let y = 0; y < layerData.length; y++) {
      for (let x = 0; x < layerData[y].length; x++) {
        const tileIndex = layerData[y][x];
        if (tileIndex < 0) continue;
        this.drawFurnitureTile(x, y, tileIndex);
      }
    }
  }

  private drawFurnitureTile(tileX: number, tileY: number, tileIndex: number): void {
    const graphics = this.add.graphics();
    graphics.setDepth(1);
    const x = tileX * TILE_SIZE;
    const y = tileY * TILE_SIZE;

    switch (tileIndex) {
      // Walls
      case 10: // Top wall
        graphics.fillStyle(PICO8_COLORS.darkPurple);
        graphics.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        graphics.fillStyle(PICO8_COLORS.lavender);
        graphics.fillRect(x, y + TILE_SIZE - 4, TILE_SIZE, 4);
        break;
      case 11: // Bottom wall
        graphics.fillStyle(PICO8_COLORS.darkPurple);
        graphics.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        graphics.fillStyle(PICO8_COLORS.lavender);
        graphics.fillRect(x, y, TILE_SIZE, 4);
        break;
      case 12: // Left wall
        graphics.fillStyle(PICO8_COLORS.darkPurple);
        graphics.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        graphics.fillStyle(PICO8_COLORS.lavender);
        graphics.fillRect(x + TILE_SIZE - 4, y, 4, TILE_SIZE);
        break;
      case 13: // Right wall
        graphics.fillStyle(PICO8_COLORS.darkPurple);
        graphics.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        graphics.fillStyle(PICO8_COLORS.lavender);
        graphics.fillRect(x, y, 4, TILE_SIZE);
        break;

      // Office furniture
      case 20: // Desk
        graphics.fillStyle(PICO8_COLORS.brown);
        graphics.fillRect(x + 2, y + 8, TILE_SIZE - 4, TILE_SIZE - 12);
        break;
      case 24: // Chair
        graphics.fillStyle(PICO8_COLORS.blue);
        graphics.fillRect(x + 8, y + 8, 16, 16);
        break;
      case 28: // Computer
        graphics.fillStyle(PICO8_COLORS.black);
        graphics.fillRect(x + 6, y + 4, 20, 14);
        graphics.fillStyle(PICO8_COLORS.darkBlue);
        graphics.fillRect(x + 8, y + 6, 16, 10);
        break;
      case 40: // Coffee machine
        graphics.fillStyle(PICO8_COLORS.darkGray);
        graphics.fillRect(x + 4, y + 4, 24, 24);
        graphics.fillStyle(PICO8_COLORS.red);
        graphics.fillRect(x + 20, y + 22, 4, 4);
        break;
      case 41: // Counter
        graphics.fillStyle(PICO8_COLORS.brown);
        graphics.fillRect(x, y + 8, TILE_SIZE, TILE_SIZE - 8);
        break;
      case 44: // Plant
        graphics.fillStyle(PICO8_COLORS.brown);
        graphics.fillRect(x + 10, y + 20, 12, 10);
        graphics.fillStyle(PICO8_COLORS.green);
        graphics.fillRect(x + 8, y + 8, 16, 14);
        break;
      case 50: // Meeting table
        graphics.fillStyle(PICO8_COLORS.brown);
        graphics.fillRect(x, y + 4, TILE_SIZE, TILE_SIZE - 4);
        break;
      case 54: // Whiteboard
        graphics.fillStyle(PICO8_COLORS.white);
        graphics.fillRect(x + 6, y + 4, 20, 22);
        break;
      case 60: // Door
        graphics.fillStyle(PICO8_COLORS.brown);
        graphics.fillRect(x + 4, y, 24, TILE_SIZE);
        graphics.fillStyle(PICO8_COLORS.yellow);
        graphics.fillRect(x + 20, y + 16, 4, 4);
        break;

      // Park
      case 70: // Fence horizontal
        graphics.fillStyle(PICO8_COLORS.brown);
        graphics.fillRect(x, y + 12, TILE_SIZE, 8);
        break;
      case 71: // Fence vertical
        graphics.fillStyle(PICO8_COLORS.brown);
        graphics.fillRect(x + 12, y, 8, TILE_SIZE);
        break;
      case 72: // Tree
        graphics.fillStyle(PICO8_COLORS.brown);
        graphics.fillRect(x + 12, y + 16, 8, 16);
        graphics.fillStyle(PICO8_COLORS.darkGreen);
        graphics.fillCircle(x + 16, y + 12, 12);
        break;
      case 73: // Bench
        graphics.fillStyle(PICO8_COLORS.brown);
        graphics.fillRect(x + 4, y + 16, 24, 8);
        graphics.fillRect(x + 6, y + 24, 4, 6);
        graphics.fillRect(x + 22, y + 24, 4, 6);
        break;
      case 74: // Fountain
        graphics.fillStyle(PICO8_COLORS.lightGray);
        graphics.fillCircle(x + 16, y + 16, 14);
        graphics.fillStyle(PICO8_COLORS.blue);
        graphics.fillCircle(x + 16, y + 16, 10);
        break;
      case 75: // Flowers
        graphics.fillStyle(PICO8_COLORS.pink);
        graphics.fillCircle(x + 8, y + 20, 4);
        graphics.fillCircle(x + 16, y + 18, 4);
        graphics.fillCircle(x + 24, y + 22, 4);
        break;

      // Residential
      case 80: // House
        graphics.fillStyle(PICO8_COLORS.peach);
        graphics.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        graphics.fillStyle(PICO8_COLORS.red);
        graphics.fillRect(x, y, TILE_SIZE, 8);
        break;
      case 81: // Street lamp
        graphics.fillStyle(PICO8_COLORS.darkGray);
        graphics.fillRect(x + 14, y + 8, 4, 24);
        graphics.fillStyle(PICO8_COLORS.yellow);
        graphics.fillCircle(x + 16, y + 6, 6);
        break;
      case 82: // Mailbox
        graphics.fillStyle(PICO8_COLORS.blue);
        graphics.fillRect(x + 10, y + 16, 12, 10);
        graphics.fillRect(x + 14, y + 26, 4, 6);
        break;

      // Coffee shop
      case 90: // Coffee counter
        graphics.fillStyle(PICO8_COLORS.brown);
        graphics.fillRect(x, y + 4, TILE_SIZE, TILE_SIZE - 4);
        graphics.fillStyle(PICO8_COLORS.orange);
        graphics.fillRect(x, y + 4, TILE_SIZE, 4);
        break;
      case 91: // Cafe table
        graphics.fillStyle(PICO8_COLORS.brown);
        graphics.fillCircle(x + 16, y + 16, 10);
        break;

      // Store
      case 92: // Store counter
        graphics.fillStyle(PICO8_COLORS.lightGray);
        graphics.fillRect(x, y + 4, TILE_SIZE, TILE_SIZE - 4);
        break;
      case 93: // Shelf
        graphics.fillStyle(PICO8_COLORS.brown);
        graphics.fillRect(x + 4, y + 4, 24, 24);
        graphics.fillStyle(PICO8_COLORS.green);
        graphics.fillRect(x + 8, y + 8, 6, 6);
        graphics.fillStyle(PICO8_COLORS.red);
        graphics.fillRect(x + 18, y + 8, 6, 6);
        graphics.fillStyle(PICO8_COLORS.blue);
        graphics.fillRect(x + 8, y + 18, 6, 6);
        graphics.fillStyle(PICO8_COLORS.yellow);
        graphics.fillRect(x + 18, y + 18, 6, 6);
        break;
    }
  }

  navigateToArea(area: TownArea): void {
    const areaData = TOWN_MAP.areas[area];
    if (!areaData) return;

    this.currentArea = area;
    
    // Center camera on area
    const centerX = (areaData.x + areaData.width / 2) * TILE_SIZE;
    const centerY = (areaData.y + areaData.height / 2) * TILE_SIZE;
    
    this.cameras.main.pan(centerX, centerY, 500, 'Power2');
    
    if (areaChangeCallback) {
      areaChangeCallback(area);
    }
    
    this.notifyViewportChange();
  }

  private notifyViewportChange(): void {
    if (viewportChangeCallback) {
      const cam = this.cameras.main;
      viewportChangeCallback(
        cam.scrollX,
        cam.scrollY,
        cam.width,
        cam.height
      );
    }
  }

  private createAgent(agentData: ApiAgentStatus): void {
    if (this.agents.has(agentData.agent_id)) return;

    const workstations = TOWN_MAP.locations.workstations;
    const agentIndex = this.agents.size;
    const workstation = workstations[agentIndex % workstations.length];
    const tileX = workstation.x + 1;
    const tileY = workstation.y + 1;

    const agent = new AgentSprite(
      this,
      tileX * TILE_SIZE + TILE_SIZE / 2,
      (tileY + 1) * TILE_SIZE,
      agentData.agent_id
    );

    agent.setInteractive(new Phaser.Geom.Rectangle(-8, -24, 16, 24), Phaser.Geom.Rectangle.Contains);
    agent.on('pointerdown', () => {
      if (agentClickCallback) {
        agentClickCallback(agentData.agent_id);
      }
    });
    agent.on('pointerover', () => agent.setScale(1.1));
    agent.on('pointerout', () => agent.setScale(1));

    const controller = new AgentMovementController(this, agent, this.pathfinder);
    controller.setPosition(tileX, tileY);
    
    this.movementControllers.set(agentData.agent_id, controller);
    this.agents.set(agentData.agent_id, agent);
    
    // Register with schedule system
    this.scheduleSystem.registerAgent(agentData.agent_id, agent, controller);
    
    // Register with social interaction system
    this.socialSystem.registerAgent(agentData.agent_id, agent);
    
    this.applyAgentStatus(agent, agentData.status);
  }

  private updateAgentState(agentData: ApiAgentStatus): void {
    const agent = this.agents.get(agentData.agent_id);
    if (agent) {
      this.applyAgentStatus(agent, agentData.status);
    }
  }

  private applyAgentStatus(agent: AgentSprite, status: string): void {
    switch (status) {
      case 'online':
        agent.work();
        agent.setVisible(true);
        agent.setAlpha(1);
        break;
      case 'idle':
        agent.rest();
        agent.setVisible(true);
        agent.setAlpha(1);
        break;
      case 'offline':
        agent.idle();
        agent.setAlpha(0.5);
        break;
      default:
        agent.idle();
    }
  }

  private removeAgent(agentId: string): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.destroy();
      this.agents.delete(agentId);
    }
    this.scheduleSystem.unregisterAgent(agentId);
    this.socialSystem.unregisterAgent(agentId);
    this.movementControllers.delete(agentId);
    this.agentData.delete(agentId);
  }

  getCurrentArea(): TownArea {
    return this.currentArea;
  }

  getTimeOfDay(): TimeOfDay {
    return this.dayNightCycle.getCurrentTime();
  }

  getGameTime(): { hour: number; minute: number } {
    return {
      hour: this.gameTime.getHour(),
      minute: this.gameTime.getMinute(),
    };
  }

  getGameTimeString(): string {
    return this.gameTime.getTimeString();
  }

  setGameTime(hour: number, minute: number = 0): void {
    this.gameTime.setTime(hour, minute);
  }

  update(): void {
    this.gameTime.update();
    this.dayNightCycle.update();
    this.scheduleSystem.update();
    this.socialSystem.update();
    this.timeText.setText(this.gameTime.getTimeString());
    this.agents.forEach(agent => agent.updateDepth());
  }

  shutdown(): void {
    if (this.pollTimer !== null) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.gameTime.destroy();
    this.dayNightCycle.destroy();
    this.scheduleSystem.destroy();
    this.socialSystem.destroy();
  }
}
