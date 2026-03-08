import Phaser from 'phaser';
import { generateTileset, TILE_SIZE } from '../tiles/tileset-generator';
import { OFFICE_MAP } from '../maps/office-map';
import { PICO8_COLORS } from '../tiles/palette';
import { AgentSprite, Direction } from '../sprites';
import { PathfindingManager, AgentMovementController, AgentStatus } from '../pathfinding';

export class OfficeScene extends Phaser.Scene {
  private collisionLayer: number[][] = [];
  private testAgents: AgentSprite[] = [];
  private pathfinder!: PathfindingManager;
  private movementControllers: Map<string, AgentMovementController> = new Map();

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

    // Initialize pathfinding
    this.pathfinder = new PathfindingManager();
    this.pathfinder.setGrid(layers.collision);

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
    // Create agents with pathfinding at workstations
    const workstations = locations.workstations;
    
    // Agent 1: Working at desk
    const agent1 = this.createAgentWithMovement('agent-alice', workstations[0].x + 1, workstations[0].y + 1);
    agent1.work();
    
    // Agent 2: Will walk to coffee area
    const agent2 = this.createAgentWithMovement('agent-bob', workstations[1].x + 1, workstations[1].y + 1);
    this.scheduleAgentMovement(agent2, 'agent-bob', locations.coffeeArea.x + 1, locations.coffeeArea.y, 'rest');
    
    // Agent 3: Thinking at desk
    const agent3 = this.createAgentWithMovement('agent-charlie', workstations[2].x + 1, workstations[2].y + 1);
    agent3.think();
    
    // Agent 4: Error state
    const agent4 = this.createAgentWithMovement('agent-diana', workstations[3].x + 1, workstations[3].y + 1);
    agent4.error();
    
    // Agent 5: Will walk from entrance to meeting room
    const agent5 = this.createAgentWithMovement('agent-eve', locations.entrance.x, locations.entrance.y - 1);
    this.scheduleAgentMovement(agent5, 'agent-eve', locations.meetingRoom.x + 2, locations.meetingRoom.y + 2, 'idle');
    
    // Agent 6: Patrol demo - walks between workstations
    const agent6 = this.createAgentWithMovement('agent-frank', workstations[4].x + 1, workstations[4].y + 1);
    this.startPatrolDemo(agent6, 'agent-frank');
  }

  private createAgentWithMovement(agentId: string, tileX: number, tileY: number): AgentSprite {
    const agent = new AgentSprite(
      this,
      tileX * TILE_SIZE + TILE_SIZE / 2,
      (tileY + 1) * TILE_SIZE,
      agentId
    );
    
    const controller = new AgentMovementController(this, agent, this.pathfinder);
    controller.setPosition(tileX, tileY);
    this.movementControllers.set(agentId, controller);
    this.testAgents.push(agent);
    
    return agent;
  }

  private async scheduleAgentMovement(
    agent: AgentSprite, 
    agentId: string, 
    targetX: number, 
    targetY: number,
    endState: 'work' | 'think' | 'rest' | 'error' | 'idle'
  ): Promise<void> {
    // Wait a bit before starting movement
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
    
    const controller = this.movementControllers.get(agentId);
    if (!controller) return;
    
    const success = await controller.moveTo(targetX, targetY);
    
    if (success) {
      switch (endState) {
        case 'work': agent.work(); break;
        case 'think': agent.think(); break;
        case 'rest': agent.rest(); break;
        case 'error': agent.error(); break;
        default: agent.idle();
      }
    }
  }

  private async startPatrolDemo(agent: AgentSprite, agentId: string): Promise<void> {
    const locations = OFFICE_MAP.locations;
    const patrolPoints = [
      { x: locations.workstations[4].x + 1, y: locations.workstations[4].y + 1 },
      { x: locations.coffeeArea.x + 1, y: locations.coffeeArea.y },
      { x: locations.meetingRoom.x + 2, y: locations.meetingRoom.y + 2 },
      { x: locations.entrance.x, y: locations.entrance.y - 1 },
    ];
    
    let pointIndex = 0;
    
    const patrol = async () => {
      const controller = this.movementControllers.get(agentId);
      if (!controller) return;
      
      const target = patrolPoints[pointIndex];
      await controller.moveTo(target.x, target.y);
      
      // Wait at location
      agent.idle();
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Move to next point
      pointIndex = (pointIndex + 1) % patrolPoints.length;
      patrol();
    };
    
    // Start patrol after delay
    await new Promise(resolve => setTimeout(resolve, 500));
    patrol();
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

  // Get pathfinder for external use
  public getPathfinder(): PathfindingManager {
    return this.pathfinder;
  }

  // Move agent to location by status
  public async moveAgentByStatus(agentId: string, status: AgentStatus): Promise<void> {
    const controller = this.movementControllers.get(agentId);
    const agent = this.testAgents.find(a => a.getAgentId() === agentId);
    if (!controller || !agent) return;

    const locations = OFFICE_MAP.locations;
    let targetX: number;
    let targetY: number;

    // Handle error state separately - stay in place
    if (status === 'error') {
      agent.error();
      return;
    }

    switch (status) {
      case 'online':
      case 'working':
        // Find available workstation
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
        // Move to entrance and hide
        targetX = locations.entrance.x;
        targetY = locations.entrance.y - 1;
        break;
    }

    const success = await controller.moveTo(targetX, targetY);
    
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
    // Update agent depths for proper layering
    this.testAgents.forEach(agent => agent.updateDepth());
  }
}
