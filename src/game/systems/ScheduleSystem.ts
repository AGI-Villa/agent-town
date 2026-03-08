import Phaser from 'phaser';
import type { TownArea } from '../maps/town-map';
import { TOWN_MAP } from '../maps/town-map';
import { AgentSprite } from '../sprites';
import { PathfindingManager, AgentMovementController } from '../pathfinding';
import { GameTimeSystem } from './GameTimeSystem';
import {
  AgentSchedule,
  ScheduleBlock,
  getScheduleForAgent,
  getScheduleBlockForHour,
} from '../config/schedules';

interface AgentScheduleState {
  agentId: string;
  schedule: AgentSchedule;
  currentBlock: ScheduleBlock | null;
  targetLocation: TownArea | null;
  isMoving: boolean;
  isSleeping: boolean;
}

type LocationChangeCallback = (agentId: string, location: TownArea, activity: string) => void;

export class ScheduleSystem {
  private scene: Phaser.Scene;
  private timeSystem: GameTimeSystem;
  private pathfinder: PathfindingManager;
  private agentStates: Map<string, AgentScheduleState> = new Map();
  private agents: Map<string, AgentSprite> = new Map();
  private movementControllers: Map<string, AgentMovementController> = new Map();
  private locationListeners: Set<LocationChangeCallback> = new Set();
  private lastCheckedHour: number = -1;

  constructor(
    scene: Phaser.Scene,
    timeSystem: GameTimeSystem,
    pathfinder: PathfindingManager
  ) {
    this.scene = scene;
    this.timeSystem = timeSystem;
    this.pathfinder = pathfinder;

    // Listen for time changes
    this.timeSystem.onTimeChange((hour) => {
      if (hour !== this.lastCheckedHour) {
        this.lastCheckedHour = hour;
        this.updateAllAgentSchedules();
      }
    });
  }

  registerAgent(
    agentId: string,
    agent: AgentSprite,
    controller: AgentMovementController
  ): void {
    const schedule = getScheduleForAgent(agentId);
    const currentHour = this.timeSystem.getHour();
    const currentBlock = getScheduleBlockForHour(schedule, currentHour);

    this.agentStates.set(agentId, {
      agentId,
      schedule,
      currentBlock,
      targetLocation: currentBlock?.location ?? null,
      isMoving: false,
      isSleeping: currentBlock?.activity === 'sleep',
    });

    this.agents.set(agentId, agent);
    this.movementControllers.set(agentId, controller);

    // Initial placement
    if (currentBlock) {
      this.moveAgentToLocation(agentId, currentBlock.location, currentBlock.activity);
    }
  }

  unregisterAgent(agentId: string): void {
    this.agentStates.delete(agentId);
    this.agents.delete(agentId);
    this.movementControllers.delete(agentId);
  }

  private updateAllAgentSchedules(): void {
    const currentHour = this.timeSystem.getHour();

    for (const [agentId, state] of this.agentStates) {
      const newBlock = getScheduleBlockForHour(state.schedule, currentHour);

      if (newBlock && newBlock !== state.currentBlock) {
        state.currentBlock = newBlock;
        state.isSleeping = newBlock.activity === 'sleep';
        this.moveAgentToLocation(agentId, newBlock.location, newBlock.activity);
      }
    }
  }

  private moveAgentToLocation(
    agentId: string,
    location: TownArea,
    activity: string
  ): void {
    const state = this.agentStates.get(agentId);
    const agent = this.agents.get(agentId);
    const controller = this.movementControllers.get(agentId);

    if (!state || !agent || !controller) return;

    state.targetLocation = location;
    state.isMoving = true;

    // Get target position in the area
    const targetPos = this.getPositionInArea(location, agentId);

    // Update agent visibility based on activity
    if (activity === 'sleep') {
      agent.setAlpha(0.3);
      agent.rest();
    } else {
      agent.setAlpha(1);
      if (activity === 'work') {
        agent.work();
      } else {
        agent.idle();
      }
    }

    // Move agent to target
    controller.moveTo(targetPos.x, targetPos.y).then(() => {
      state.isMoving = false;
      this.notifyLocationChange(agentId, location, activity);
    });
  }

  private getPositionInArea(area: TownArea, agentId: string): { x: number; y: number } {
    const areaData = TOWN_MAP.areas[area];
    const locations = TOWN_MAP.locations;

    // Use specific locations if available
    switch (area) {
      case 'office': {
        const workstations = locations.workstations;
        const hash = agentId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
        const ws = workstations[hash % workstations.length];
        return { x: ws.x + 1, y: ws.y + 1 };
      }
      case 'coffeeShop': {
        const tables = locations.cafeTables;
        const hash = agentId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
        const table = tables[hash % tables.length];
        return { x: table.x, y: table.y + 1 };
      }
      case 'park': {
        const benches = locations.parkBenches;
        const hash = agentId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
        const bench = benches[hash % benches.length];
        return { x: bench.x, y: bench.y + 1 };
      }
      case 'residential': {
        const homes = locations.homes;
        const hash = agentId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
        const home = homes[hash % homes.length];
        return { x: home.x + 1, y: home.y + 2 };
      }
      case 'store': {
        // Random position in store area
        return {
          x: areaData.x + 2 + Math.floor(Math.random() * (areaData.width - 4)),
          y: areaData.y + 2 + Math.floor(Math.random() * (areaData.height - 4)),
        };
      }
      default:
        return {
          x: areaData.x + Math.floor(areaData.width / 2),
          y: areaData.y + Math.floor(areaData.height / 2),
        };
    }
  }

  getAgentState(agentId: string): AgentScheduleState | undefined {
    return this.agentStates.get(agentId);
  }

  getAgentLocation(agentId: string): TownArea | null {
    return this.agentStates.get(agentId)?.targetLocation ?? null;
  }

  isAgentSleeping(agentId: string): boolean {
    return this.agentStates.get(agentId)?.isSleeping ?? false;
  }

  onLocationChange(callback: LocationChangeCallback): () => void {
    this.locationListeners.add(callback);
    return () => this.locationListeners.delete(callback);
  }

  private notifyLocationChange(
    agentId: string,
    location: TownArea,
    activity: string
  ): void {
    this.locationListeners.forEach(cb => cb(agentId, location, activity));
  }

  update(): void {
    // Movement controllers handle their own updates
  }

  destroy(): void {
    this.agentStates.clear();
    this.agents.clear();
    this.movementControllers.clear();
    this.locationListeners.clear();
  }
}
