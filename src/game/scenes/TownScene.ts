import Phaser from 'phaser';
import { TILE_SIZE } from '../tiles/tileset-generator';
import { TOWN_MAP, TownArea } from '../maps/town-map';
import { TownRenderer } from '../rendering/TownRenderer';
import { AgentSprite } from '../sprites';
import { PetSprite } from '../sprites/PetSprite';
import { PathfindingManager, AgentMovementController } from '../pathfinding';
import { DayNightCycle, TimeOfDay, GameTimeSystem, TimeSpeed, ScheduleSystem, SocialInteractionSystem, PerformanceManager, TouchInputManager } from '../systems';
import type { AgentStatus as ApiAgentStatus } from '@/lib/types';

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

const AREA_KEYS: TownArea[] = ['office', 'park', 'plaza', 'coffeeShop', 'store', 'residential'];

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
  private performanceManager!: PerformanceManager;
  private touchInput!: TouchInputManager;
  private currentArea: TownArea = 'office';
  private timeText!: Phaser.GameObjects.Text;
  private speedText!: Phaser.GameObjects.Text;
  private isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private pollTimer: number | null = null;
  private pets: PetSprite[] = [];
  private mapWidth = 0;
  private mapHeight = 0;

  constructor() {
    super({ key: 'TownScene' });
  }

  preload(): void {}

  create(): void {
    const { width, height, layers } = TOWN_MAP;
    this.mapWidth = width * TILE_SIZE;
    this.mapHeight = height * TILE_SIZE;

    this.collisionLayer = layers.collision;
    this.pathfinder = new PathfindingManager();
    this.pathfinder.setGrid(layers.collision);

    const townRenderer = new TownRenderer(this, TOWN_MAP);
    townRenderer.renderAll();

    this.gameTime = new GameTimeSystem(this, { startHour: 10, startMinute: 0, speed: 1 });
    this.gameTime.start();

    this.scheduleSystem = new ScheduleSystem(this, this.gameTime, this.pathfinder);
    this.socialSystem = new SocialInteractionSystem(this);
    this.socialSystem.start();
    this.performanceManager = new PerformanceManager(this);
    this.touchInput = new TouchInputManager(this);
    this.touchInput.create();

    this.dayNightCycle = new DayNightCycle(this, { cycleDurationMs: 120000, startTime: 'day' });
    this.dayNightCycle.create(this.mapWidth, this.mapHeight);
    this.dayNightCycle.start();

    this.gameTime.onTimeChange((hour) => {
      if (hour >= 6 && hour < 8) this.dayNightCycle.setTime('dawn');
      else if (hour >= 8 && hour < 18) this.dayNightCycle.setTime('day');
      else if (hour >= 18 && hour < 20) this.dayNightCycle.setTime('dusk');
      else this.dayNightCycle.setTime('night');
      this.notifyTimeChange();
    });

    // HUD — fixed to screen corners
    this.timeText = this.add.text(16, 16, '10:00', {
      fontSize: '11px', color: '#ffffff', fontFamily: '"Press Start 2P", monospace',
      backgroundColor: 'rgba(0,0,0,0.5)', padding: { x: 6, y: 4 },
    }).setDepth(200).setScrollFactor(0);

    this.speedText = this.add.text(16, 36, '1x', {
      fontSize: '9px', color: '#ffcc00', fontFamily: '"Press Start 2P", monospace',
      backgroundColor: 'rgba(0,0,0,0.5)', padding: { x: 6, y: 3 },
    }).setDepth(200).setScrollFactor(0);
    this.speedText.setInteractive({ useHandCursor: true });
    this.speedText.on('pointerdown', () => this.cycleSpeed());

    // Camera — show full map initially, allow zoom/pan
    this.cameras.main.setBounds(0, 0, this.mapWidth, this.mapHeight);
    this.fitMapToScreen();

    // Drag to pan (any mouse button)
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.isDragging = true;
      this.dragStartX = pointer.x;
      this.dragStartY = pointer.y;
    });
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.isDragging && pointer.isDown) {
        const zoom = this.cameras.main.zoom;
        this.cameras.main.scrollX += (this.dragStartX - pointer.x) / zoom;
        this.cameras.main.scrollY += (this.dragStartY - pointer.y) / zoom;
        this.dragStartX = pointer.x;
        this.dragStartY = pointer.y;
        this.notifyViewportChange();
      }
    });
    this.input.on('pointerup', () => { this.isDragging = false; });

    // Scroll to zoom
    this.input.on('wheel', (_p: Phaser.Input.Pointer, _go: Phaser.GameObjects.GameObject[], _dx: number, dy: number) => {
      const cam = this.cameras.main;
      const delta = dy > 0 ? -0.15 : 0.15;
      cam.setZoom(Phaser.Math.Clamp(cam.zoom + delta, 0.5, 4));
      this.notifyViewportChange();
    });

    // Keyboard shortcuts
    this.input.keyboard?.on('keydown-ONE', () => this.navigateToArea('office'));
    this.input.keyboard?.on('keydown-TWO', () => this.navigateToArea('park'));
    this.input.keyboard?.on('keydown-THREE', () => this.navigateToArea('plaza'));
    this.input.keyboard?.on('keydown-FOUR', () => this.navigateToArea('coffeeShop'));
    this.input.keyboard?.on('keydown-FIVE', () => this.navigateToArea('store'));
    this.input.keyboard?.on('keydown-SIX', () => this.navigateToArea('residential'));
    this.input.keyboard?.on('keydown-COMMA', () => this.setTimeSpeed(1));
    this.input.keyboard?.on('keydown-PERIOD', () => this.setTimeSpeed(10));
    this.input.keyboard?.on('keydown-FORWARD_SLASH', () => this.setTimeSpeed(60));
    this.input.keyboard?.on('keydown-ZERO', () => this.fitMapToScreen());

    this.spawnPets();
    this.startPolling();
  }

  private fitMapToScreen(): void {
    const cam = this.cameras.main;
    const zoomX = cam.width / this.mapWidth;
    const zoomY = cam.height / this.mapHeight;
    const zoom = Math.max(Math.min(zoomX, zoomY), 0.5);
    cam.setZoom(zoom);
    cam.centerOn(this.mapWidth / 2, this.mapHeight / 2);
  }

  private cycleSpeed(): void {
    const speeds: TimeSpeed[] = [1, 10, 60];
    const idx = speeds.indexOf(this.gameTime.getSpeed());
    this.setTimeSpeed(speeds[(idx + 1) % speeds.length]);
  }

  setTimeSpeed(speed: TimeSpeed): void {
    this.gameTime.setSpeed(speed);
    this.speedText.setText(`${speed}x`);
    this.notifyTimeChange();
  }

  getTimeSpeed(): TimeSpeed { return this.gameTime.getSpeed(); }

  private notifyTimeChange(): void {
    timeChangeCallback?.(this.gameTime.getHour(), this.gameTime.getMinute(), this.gameTime.getSpeed());
  }

  private async startPolling(): Promise<void> {
    await this.fetchAndUpdateAgents();
    this.pollTimer = window.setInterval(() => this.fetchAndUpdateAgents(), 5000);
  }

  private async fetchAndUpdateAgents(): Promise<void> {
    if (!this.sys?.displayList) return;
    try {
      const res = await fetch('/api/agents');
      if (!res.ok) return;
      const agents: ApiAgentStatus[] = await res.json();
      const newIds = new Set(agents.map(a => a.agent_id));
      for (const agent of agents) {
        if (!this.agents.has(agent.agent_id)) {
          this.createAgent(agent);
        } else {
          this.updateAgentState(agent);
        }
        this.agentData.set(agent.agent_id, agent);
      }
      for (const id of this.agents.keys()) {
        if (!newIds.has(id)) this.removeAgent(id);
      }
    } catch (err) {
      console.error('Failed to fetch agents:', err);
    }
  }

  navigateToArea(area: TownArea): void {
    const ad = TOWN_MAP.areas[area];
    if (!ad) return;
    this.currentArea = area;
    const cx = (ad.x + ad.width / 2) * TILE_SIZE;
    const cy = (ad.y + ad.height / 2) * TILE_SIZE;
    this.cameras.main.pan(cx, cy, 500, 'Power2');
    areaChangeCallback?.(area);
    this.notifyViewportChange();
  }

  private notifyViewportChange(): void {
    if (viewportChangeCallback) {
      const c = this.cameras.main;
      viewportChangeCallback(c.scrollX, c.scrollY, c.width, c.height);
    }
  }

  private createAgent(agentData: ApiAgentStatus): void {
    if (this.agents.has(agentData.agent_id)) return;
    if (!this.sys?.displayList) return;

    // Spread agents across all areas round-robin
    const idx = this.agents.size;
    const areaKey = AREA_KEYS[idx % AREA_KEYS.length];
    const area = TOWN_MAP.areas[areaKey];
    const slotInArea = Math.floor(idx / AREA_KEYS.length);
    const cols = area.width - 4;
    const tileX = area.x + 2 + (slotInArea % cols);
    const tileY = area.y + 2 + Math.floor(slotInArea / cols) % (area.height - 4);

    const agent = new AgentSprite(
      this,
      tileX * TILE_SIZE + TILE_SIZE / 2,
      (tileY + 1) * TILE_SIZE,
      agentData.agent_id
    );
    agent.setInteractive(new Phaser.Geom.Rectangle(-8, -24, 16, 24), Phaser.Geom.Rectangle.Contains);
    agent.on('pointerdown', () => agentClickCallback?.(agentData.agent_id));
    agent.on('pointerover', () => agent.setScale(1.1));
    agent.on('pointerout', () => agent.setScale(1));

    const controller = new AgentMovementController(this, agent, this.pathfinder);
    controller.setPosition(tileX, tileY);
    this.movementControllers.set(agentData.agent_id, controller);
    this.agents.set(agentData.agent_id, agent);
    this.scheduleSystem.registerAgent(agentData.agent_id, agent, controller);
    this.socialSystem.registerAgent(agentData.agent_id, agent);
    this.performanceManager.registerAgent(agentData.agent_id, agent);
    this.applyAgentStatus(agent, agentData.status);
  }

  private updateAgentState(agentData: ApiAgentStatus): void {
    const agent = this.agents.get(agentData.agent_id);
    if (agent) this.applyAgentStatus(agent, agentData.status);
  }

  private applyAgentStatus(agent: AgentSprite, status: string): void {
    switch (status) {
      case 'online':
        agent.work(); agent.setVisible(true); agent.setAlpha(1); break;
      case 'idle':
        agent.rest(); agent.setVisible(true); agent.setAlpha(1); break;
      default:
        agent.idle(); agent.setAlpha(0.6);
    }
  }

  private removeAgent(agentId: string): void {
    const agent = this.agents.get(agentId);
    if (agent) { agent.destroy(); this.agents.delete(agentId); }
    this.scheduleSystem.unregisterAgent(agentId);
    this.socialSystem.unregisterAgent(agentId);
    this.performanceManager.unregisterAgent(agentId);
    this.movementControllers.delete(agentId);
    this.agentData.delete(agentId);
  }

  getCurrentArea(): TownArea { return this.currentArea; }
  getTimeOfDay(): TimeOfDay { return this.dayNightCycle.getCurrentTime(); }
  getGameTime(): { hour: number; minute: number } { return { hour: this.gameTime.getHour(), minute: this.gameTime.getMinute() }; }
  getGameTimeString(): string { return this.gameTime.getTimeString(); }
  setGameTime(hour: number, minute: number = 0): void { this.gameTime.setTime(hour, minute); }

  update(_time: number, delta: number): void {
    this.gameTime.update();
    this.dayNightCycle.update();
    this.scheduleSystem.update();
    this.socialSystem.update();
    this.performanceManager.update();
    this.timeText.setText(this.gameTime.getTimeString());
    this.agents.forEach(agent => agent.updateDepth());
    for (const pet of this.pets) pet.update(_time, delta);
    this.checkPetInteractions();
  }

  private spawnPets(): void {
    const petDefs: { type: 'cat' | 'dog'; name: string; area: string }[] = [
      { type: 'cat', name: 'Mochi', area: 'office' },
      { type: 'cat', name: 'Luna', area: 'park' },
      { type: 'cat', name: 'Neko', area: 'residential' },
      { type: 'cat', name: 'Mimi', area: 'store' },
      { type: 'dog', name: 'Buddy', area: 'park' },
      { type: 'dog', name: 'Max', area: 'coffeeShop' },
      { type: 'dog', name: 'Rex', area: 'residential' },
      { type: 'cat', name: 'Whiskers', area: 'plaza' },
    ];
    for (let i = 0; i < petDefs.length; i++) {
      const def = petDefs[i];
      const area = TOWN_MAP.areas[def.area as keyof typeof TOWN_MAP.areas];
      if (!area) continue;
      const px = (area.x + 2 + Math.random() * (area.width - 4)) * TILE_SIZE;
      const py = (area.y + 2 + Math.random() * (area.height - 4)) * TILE_SIZE;
      const pet = new PetSprite(this, px, py, def.type, def.name, i, this.mapWidth, this.mapHeight);
      this.pets.push(pet);
    }
  }

  private checkPetInteractions(): void {
    for (const pet of this.pets) {
      if (pet.getIsInteracting()) continue;
      for (const [, agent] of this.agents) {
        const dx = pet.x - agent.x;
        const dy = pet.y - agent.y;
        if (Math.sqrt(dx * dx + dy * dy) < TILE_SIZE * 1.5) {
          pet.showInteraction(pet.getPetType() === 'cat' ? '😺' : '🐶');
          break;
        }
      }
    }
  }

  shutdown(): void {
    if (this.pollTimer !== null) { clearInterval(this.pollTimer); this.pollTimer = null; }
    this.gameTime.destroy();
    this.dayNightCycle.destroy();
    this.scheduleSystem.destroy();
    this.socialSystem.destroy();
    this.performanceManager.destroy();
    this.touchInput.destroy();
  }

  getPerformanceStats() { return this.performanceManager.getStats(); }
  setZoom(zoom: number): void { this.touchInput.setZoom(zoom); }
  getZoom(): number { return this.touchInput.getZoom(); }
}
