import Phaser from 'phaser';
import { TILE_SIZE } from '../tiles/tileset-generator';
import { OFFICE_MAP } from '../maps/office-map';
import { TownRenderer } from '../rendering/TownRenderer';
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

  create(): void {
    const { width, height, layers, locations } = OFFICE_MAP;
    const mapWidth = width * TILE_SIZE;
    const mapHeight = height * TILE_SIZE;

    this.collisionLayer = layers.collision;
    this.pathfinder = new PathfindingManager();
    this.pathfinder.setGrid(layers.collision);

    const renderer = new TownRenderer(this, {
      width, height,
      layers: { ground: layers.ground, furniture: layers.furniture },
    });
    renderer.renderAll();

    this.add.text(mapWidth / 2, 16, 'AGENT TOWN OFFICE', {
      fontSize: '11px',
      fontFamily: '"Press Start 2P", monospace',
      color: '#ffffff',
      backgroundColor: 'rgba(0,0,0,0.55)',
      padding: { x: 8, y: 4 },
    }).setOrigin(0.5, 0).setDepth(100);

    this.cameras.main.setBounds(0, 0, mapWidth, mapHeight);
    this.cameras.main.setZoom(2);
    this.cameras.main.centerOn(mapWidth / 2, mapHeight / 2);

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
