import Phaser from 'phaser';
import { generateTileset, TILE_SIZE } from '../tiles/tileset-generator';
import { OFFICE_MAP } from '../maps/office-map';
import { PICO8_COLORS } from '../tiles/palette';
import { AgentSprite, Direction } from '../sprites';
import { PathfindingManager, AgentMovementController, AgentStatus } from '../pathfinding';
import { getAgentStateService, AgentStateChangeHandler } from '../services';
import type { AgentStatus as ApiAgentStatus } from '@/lib/types';

// Event emitter for agent clicks (to communicate with React)
type AgentClickCallback = (agentId: string) => void;
let agentClickCallback: AgentClickCallback | null = null;

export function setAgentClickCallback(callback: AgentClickCallback | null): void {
  agentClickCallback = callback;
}

export class OfficeScene extends Phaser.Scene {
  private collisionLayer: number[][] = [];
  private agents: Map<string, AgentSprite> = new Map();
  private pathfinder!: PathfindingManager;
  private movementControllers: Map<string, AgentMovementController> = new Map();
  private stateService = getAgentStateService();
  private unsubscribe: (() => void) | null = null;

  constructor() {
    super({ key: 'OfficeScene' });
  }

  preload(): void {
    generateTileset(this);
  }

  create(): void {
    const { width, height, layers, locations } = OFFICE_MAP;
    const mapWidth = width * TILE_SIZE;
    const mapHeight = height * TILE_SIZE;

    this.collisionLayer = layers.collision;
    this.pathfinder = new PathfindingManager();
    this.pathfinder.setGrid(layers.collision);

    this.renderLayer(layers.ground, 0);
    this.renderLayer(layers.furniture, 1);
    this.renderCollisionDebug(false);
    this.addLocationMarkers(locations);

    this.add.text(mapWidth / 2, 16, 'Agent Town Office', {
      fontSize: '16px',
      color: '#ffffff',
      fontFamily: 'monospace',
      backgroundColor: '#1d2b53',
      padding: { x: 8, y: 4 },
    }).setOrigin(0.5, 0).setDepth(100);

    this.cameras.main.setBounds(0, 0, mapWidth, mapHeight);

    // Subscribe to state changes
    const handleStateChange: AgentStateChangeHandler = (added, updated, removed) => {
      this.handleAgentChanges(added, updated, removed);
    };
    this.unsubscribe = this.stateService.subscribe(handleStateChange);

    // Start the state service and initialize agents
    this.stateService.start().then(() => {
      const agents = this.stateService.getAgents();
      if (agents.length > 0) {
        this.handleAgentChanges(agents, [], []);
      }
    });
  }

  private handleAgentChanges(
    added: ApiAgentStatus[],
    updated: ApiAgentStatus[],
    removed: string[]
  ): void {
    // Add new agents
    for (const agent of added) {
      this.createAgent(agent);
    }

    // Update existing agents
    for (const agent of updated) {
      this.updateAgentState(agent);
    }

    // Remove offline agents
    for (const agentId of removed) {
      this.removeAgent(agentId);
    }
  }

  private createAgent(agentData: ApiAgentStatus): void {
    if (this.agents.has(agentData.agent_id)) return;

    const locations = OFFICE_MAP.locations;
    const workstations = locations.workstations;
    
    // Find available workstation
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

    // Make agent interactive
    agent.setInteractive(new Phaser.Geom.Rectangle(-8, -24, 16, 24), Phaser.Geom.Rectangle.Contains);
    agent.on('pointerdown', () => {
      if (agentClickCallback) {
        agentClickCallback(agentData.agent_id);
      }
    });
    agent.on('pointerover', () => {
      agent.setScale(1.1);
    });
    agent.on('pointerout', () => {
      agent.setScale(1);
    });

    const controller = new AgentMovementController(this, agent, this.pathfinder);
    controller.setPosition(tileX, tileY);
    
    this.movementControllers.set(agentData.agent_id, controller);
    this.agents.set(agentData.agent_id, agent);

    // Set initial state based on status
    this.applyAgentStatus(agent, agentData.status);
  }

  private updateAgentState(agentData: ApiAgentStatus): void {
    const agent = this.agents.get(agentData.agent_id);
    if (!agent) return;

    this.applyAgentStatus(agent, agentData.status);
  }

  private applyAgentStatus(agent: AgentSprite, status: string): void {
    switch (status) {
      case 'online':
        agent.work();
        agent.setVisible(true);
        break;
      case 'idle':
        agent.rest();
        agent.setVisible(true);
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
    this.movementControllers.delete(agentId);
  }

  private renderLayer(layerData: number[][], depth: number): void {
    for (let y = 0; y < layerData.length; y++) {
      for (let x = 0; x < layerData[y].length; x++) {
        const tileIndex = layerData[y][x];
        if (tileIndex < 0) continue;
        this.drawTile(x, y, tileIndex, depth);
      }
    }
  }

  private drawTile(tileX: number, tileY: number, tileIndex: number, depth: number): void {
    const graphics = this.add.graphics();
    graphics.setDepth(depth);
    
    const x = tileX * TILE_SIZE;
    const y = tileY * TILE_SIZE;

    switch (tileIndex) {
      case 0:
        graphics.fillStyle(PICO8_COLORS.lightGray);
        graphics.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        graphics.fillStyle(PICO8_COLORS.white);
        graphics.fillRect(x + 2, y + 2, 4, 4);
        break;
      case 1:
        graphics.fillStyle(PICO8_COLORS.darkGray);
        graphics.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        break;
      case 2:
        graphics.fillStyle(PICO8_COLORS.darkBlue);
        graphics.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        graphics.fillStyle(PICO8_COLORS.lavender);
        for (let i = 0; i < 4; i++) {
          graphics.fillRect(x + 4 + i * 8, y + 4, 2, 2);
          graphics.fillRect(x + 8 + i * 8, y + 20, 2, 2);
        }
        break;
      case 10:
        graphics.fillStyle(PICO8_COLORS.darkPurple);
        graphics.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        graphics.fillStyle(PICO8_COLORS.lavender);
        graphics.fillRect(x, y + TILE_SIZE - 4, TILE_SIZE, 4);
        break;
      case 11:
        graphics.fillStyle(PICO8_COLORS.darkPurple);
        graphics.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        graphics.fillStyle(PICO8_COLORS.lavender);
        graphics.fillRect(x, y, TILE_SIZE, 4);
        break;
      case 12:
        graphics.fillStyle(PICO8_COLORS.darkPurple);
        graphics.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        graphics.fillStyle(PICO8_COLORS.lavender);
        graphics.fillRect(x + TILE_SIZE - 4, y, 4, TILE_SIZE);
        break;
      case 13:
        graphics.fillStyle(PICO8_COLORS.darkPurple);
        graphics.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        graphics.fillStyle(PICO8_COLORS.lavender);
        graphics.fillRect(x, y, 4, TILE_SIZE);
        break;
      case 20:
        graphics.fillStyle(PICO8_COLORS.brown);
        graphics.fillRect(x + 2, y + 8, TILE_SIZE - 4, TILE_SIZE - 12);
        graphics.fillStyle(PICO8_COLORS.darkGray);
        graphics.fillRect(x + 4, y + TILE_SIZE - 6, 4, 6);
        graphics.fillRect(x + TILE_SIZE - 8, y + TILE_SIZE - 6, 4, 6);
        break;
      case 24:
        graphics.fillStyle(PICO8_COLORS.blue);
        graphics.fillRect(x + 8, y + 8, 16, 16);
        graphics.fillStyle(PICO8_COLORS.darkBlue);
        graphics.fillRect(x + 10, y + 2, 12, 8);
        break;
      case 28:
        graphics.fillStyle(PICO8_COLORS.darkGray);
        graphics.fillRect(x + 8, y + 16, 16, 12);
        graphics.fillStyle(PICO8_COLORS.black);
        graphics.fillRect(x + 6, y + 4, 20, 14);
        graphics.fillStyle(PICO8_COLORS.darkBlue);
        graphics.fillRect(x + 8, y + 6, 16, 10);
        graphics.fillStyle(PICO8_COLORS.green);
        graphics.fillRect(x + 10, y + 8, 4, 2);
        break;
      case 40:
        graphics.fillStyle(PICO8_COLORS.darkGray);
        graphics.fillRect(x + 4, y + 4, 24, 24);
        graphics.fillStyle(PICO8_COLORS.black);
        graphics.fillRect(x + 8, y + 8, 16, 12);
        graphics.fillStyle(PICO8_COLORS.red);
        graphics.fillRect(x + 20, y + 22, 4, 4);
        graphics.fillStyle(PICO8_COLORS.brown);
        graphics.fillRect(x + 10, y + 22, 8, 6);
        break;
      case 41:
        graphics.fillStyle(PICO8_COLORS.brown);
        graphics.fillRect(x, y + 8, TILE_SIZE, TILE_SIZE - 8);
        graphics.fillStyle(PICO8_COLORS.lightGray);
        graphics.fillRect(x, y + 8, TILE_SIZE, 4);
        break;
      case 44:
        graphics.fillStyle(PICO8_COLORS.brown);
        graphics.fillRect(x + 10, y + 20, 12, 10);
        graphics.fillStyle(PICO8_COLORS.darkGreen);
        graphics.fillRect(x + 8, y + 8, 16, 14);
        graphics.fillStyle(PICO8_COLORS.green);
        graphics.fillRect(x + 12, y + 4, 8, 8);
        break;
      case 50:
        graphics.fillStyle(PICO8_COLORS.brown);
        graphics.fillRect(x, y + 4, TILE_SIZE, TILE_SIZE - 4);
        graphics.fillStyle(PICO8_COLORS.orange);
        graphics.fillRect(x + 2, y + 6, TILE_SIZE - 4, TILE_SIZE - 8);
        break;
      case 54:
        graphics.fillStyle(PICO8_COLORS.darkGray);
        graphics.fillRect(x + 4, y + 2, 24, 28);
        graphics.fillStyle(PICO8_COLORS.white);
        graphics.fillRect(x + 6, y + 4, 20, 22);
        graphics.fillStyle(PICO8_COLORS.blue);
        graphics.fillRect(x + 8, y + 8, 12, 2);
        graphics.fillStyle(PICO8_COLORS.red);
        graphics.fillRect(x + 8, y + 14, 8, 2);
        break;
      case 60:
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
    const entrance = locations.entrance;
    this.add.circle(
      entrance.x * TILE_SIZE + TILE_SIZE / 2,
      entrance.y * TILE_SIZE + TILE_SIZE / 2,
      8,
      PICO8_COLORS.green
    ).setDepth(10).setAlpha(0.7);
  }

  public isColliding(tileX: number, tileY: number): boolean {
    if (
      tileY < 0 || tileY >= this.collisionLayer.length ||
      tileX < 0 || tileX >= this.collisionLayer[0].length
    ) {
      return true;
    }
    return this.collisionLayer[tileY][tileX] === 1;
  }

  public getPathfinder(): PathfindingManager {
    return this.pathfinder;
  }

  public async moveAgentByStatus(agentId: string, status: AgentStatus): Promise<void> {
    const controller = this.movementControllers.get(agentId);
    const agent = this.agents.get(agentId);
    if (!controller || !agent) return;

    const locations = OFFICE_MAP.locations;
    let targetX: number;
    let targetY: number;

    if (status === 'error') {
      agent.error();
      return;
    }

    switch (status) {
      case 'online':
      case 'working':
        const workstation = locations.workstations.find(ws => 
          !this.pathfinder.isTileOccupied(ws.x + 1, ws.y + 1, agentId)
        ) || locations.workstations[0];
        targetX = workstation.x + 1;
        targetY = workstation.y + 1;
        break;
      case 'idle':
        targetX = locations.coffeeArea.x + 1;
        targetY = locations.coffeeArea.y;
        break;
      case 'offline':
        targetX = locations.entrance.x;
        targetY = locations.entrance.y - 1;
        break;
    }

    const success = await controller.moveTo(targetX!, targetY!);
    
    if (success) {
      switch (status) {
        case 'working': agent.work(); break;
        case 'idle': agent.rest(); break;
        case 'offline': agent.setVisible(false); break;
        default: agent.idle();
      }
    }
  }

  update(): void {
    this.agents.forEach(agent => agent.updateDepth());
  }

  shutdown(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }

}
