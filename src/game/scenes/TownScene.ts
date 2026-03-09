import Phaser from 'phaser';
import { TILE_SIZE } from '../tiles/tileset-generator';
import { TOWN_MAP, TownArea } from '../maps/town-map';
import { TownRenderer } from '../rendering/TownRenderer';
import { AgentSprite } from '../sprites';
import { PetSprite } from '../sprites/PetSprite';
import { PathfindingManager, AgentMovementController } from '../pathfinding';
import {
  DayNightCycle,
  TimeOfDay,
  GameTimeSystem,
  TimeSpeed,
  ScheduleSystem,
  SocialInteractionSystem,
  PerformanceManager,
  TouchInputManager,
  MeetingSystem,
  EnvironmentSystem,
  WeatherType,
  generateRandomWeather,
  getWeatherIcon,
} from '../systems';
import type { AgentStatus as ApiAgentStatus } from '@/lib/types';

type AgentClickCallback = (agentId: string) => void;
type AreaChangeCallback = (area: TownArea) => void;
type ViewportChangeCallback = (x: number, y: number, w: number, h: number) => void;
type TimeChangeCallback = (hour: number, minute: number, speed: TimeSpeed) => void;
type WeatherChangeCallback = (weather: WeatherType, icon: string) => void;
type AgentDetailCallback = (agentId: string, details: AgentDetails) => void;
type AgentFocusCallback = (agentId: string) => void;

interface AgentDetails {
  agentId: string;
  activity: string;
  location: string;
  mood: string;
  status: string;
}

let agentClickCallback: AgentClickCallback | null = null;
let areaChangeCallback: AreaChangeCallback | null = null;
let viewportChangeCallback: ViewportChangeCallback | null = null;
let timeChangeCallback: TimeChangeCallback | null = null;
let weatherChangeCallback: WeatherChangeCallback | null = null;
let agentDetailCallback: AgentDetailCallback | null = null;
let agentFocusCallback: AgentFocusCallback | null = null;

export function setTownCallbacks(callbacks: {
  onAgentClick?: AgentClickCallback | null;
  onAreaChange?: AreaChangeCallback | null;
  onViewportChange?: ViewportChangeCallback | null;
  onTimeChange?: TimeChangeCallback | null;
  onWeatherChange?: WeatherChangeCallback | null;
  onAgentDetail?: AgentDetailCallback | null;
  onAgentFocus?: AgentFocusCallback | null;
}): void {
  agentClickCallback = callbacks.onAgentClick ?? null;
  areaChangeCallback = callbacks.onAreaChange ?? null;
  viewportChangeCallback = callbacks.onViewportChange ?? null;
  timeChangeCallback = callbacks.onTimeChange ?? null;
  weatherChangeCallback = callbacks.onWeatherChange ?? null;
  agentDetailCallback = callbacks.onAgentDetail ?? null;
  agentFocusCallback = callbacks.onAgentFocus ?? null;
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
  private meetingSystem!: MeetingSystem;
  private performanceManager!: PerformanceManager;
  private touchInput!: TouchInputManager;
  private environmentSystem!: EnvironmentSystem;
  private currentArea: TownArea = 'office';
  private currentWeather: WeatherType = 'sunny';
  private timeText!: Phaser.GameObjects.Text;
  private weatherText!: Phaser.GameObjects.Text;
  private speedText!: Phaser.GameObjects.Text;
  private isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private pollTimer: number | null = null;
  private weatherTimer: number | null = null;
  private pets: PetSprite[] = [];
  private mapWidth = 0;
  private mapHeight = 0;
  
  // Minimap
  private minimapContainer!: Phaser.GameObjects.Container;
  private minimapGraphics!: Phaser.GameObjects.Graphics;
  private minimapAgentDots: Map<string, Phaser.GameObjects.Graphics> = new Map();
  private minimapViewport!: Phaser.GameObjects.Graphics;
  
  // Agent detail panel
  private detailPanel: Phaser.GameObjects.Container | null = null;
  private selectedAgentId: string | null = null;
  
  // Agent highlight effect
  private highlightGraphics: Phaser.GameObjects.Graphics | null = null;
  private highlightTween: Phaser.Tweens.Tween | null = null;

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
    this.meetingSystem = new MeetingSystem(this, this.pathfinder);
    this.performanceManager = new PerformanceManager(this);
    this.touchInput = new TouchInputManager(this);
    this.touchInput.create();

    this.dayNightCycle = new DayNightCycle(this, { cycleDurationMs: 120000, startTime: 'day' });
    this.dayNightCycle.create(this.mapWidth, this.mapHeight);
    this.dayNightCycle.start();

    // Environment system for weather effects
    const initialWeather = generateRandomWeather();
    this.currentWeather = initialWeather.condition as WeatherType;
    this.environmentSystem = new EnvironmentSystem(this, this.mapWidth, this.mapHeight, {
      weather: this.currentWeather,
      holiday: 'none',
      particleCount: 80,
    });
    this.environmentSystem.create();

    // Listen for weather changes to update agent behavior
    this.environmentSystem.onWeatherChange((weather) => {
      this.currentWeather = weather;
      this.updateWeatherUI();
      this.handleWeatherBehavior(weather);
      weatherChangeCallback?.(weather, getWeatherIcon(weather));
    });

    this.gameTime.onTimeChange((hour) => {
      if (hour >= 6 && hour < 8) this.dayNightCycle.setTime('dawn');
      else if (hour >= 8 && hour < 18) this.dayNightCycle.setTime('day');
      else if (hour >= 18 && hour < 20) this.dayNightCycle.setTime('dusk');
      else this.dayNightCycle.setTime('night');
      this.notifyTimeChange();
      // Handle night behavior - agents go home
      this.handleNightBehavior(hour);
    });

    // HUD — fixed to screen corners
    this.timeText = this.add.text(16, 16, '10:00', {
      fontSize: '11px', color: '#ffffff', fontFamily: '"Press Start 2P", monospace',
      backgroundColor: 'rgba(0,0,0,0.5)', padding: { x: 6, y: 4 },
    }).setDepth(200).setScrollFactor(0);

    // Weather indicator
    this.weatherText = this.add.text(80, 16, getWeatherIcon(this.currentWeather), {
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
    this.cameras.main.setBackgroundColor('#4a7c59'); // Grass green background
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

    // Scroll to zoom with smooth transition
    this.input.on('wheel', (_p: Phaser.Input.Pointer, _go: Phaser.GameObjects.GameObject[], _dx: number, dy: number) => {
      const cam = this.cameras.main;
      const delta = dy > 0 ? -0.15 : 0.15;
      // Calculate minimum zoom to fill viewport (no black edges)
      const minZoomX = cam.width / this.mapWidth;
      const minZoomY = cam.height / this.mapHeight;
      const minZoom = Math.max(minZoomX, minZoomY, 0.5);
      const targetZoom = Phaser.Math.Clamp(cam.zoom + delta, minZoom, 4);
      
      // Smooth zoom transition using tween
      this.tweens.add({
        targets: cam,
        zoom: targetZoom,
        duration: 150,
        ease: 'Sine.easeOut',
        onUpdate: () => this.notifyViewportChange(),
      });
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

    // Create minimap
    this.createMinimap();

    this.spawnPets();
    this.startPolling();
    this.startWeatherCycle();
  }

  private fitMapToScreen(): void {
    const cam = this.cameras.main;
    // Use max to ensure map fills viewport (no black edges)
    const zoomX = cam.width / this.mapWidth;
    const zoomY = cam.height / this.mapHeight;
    const zoom = Math.max(zoomX, zoomY, 0.5);
    cam.setZoom(zoom);
    cam.centerOn(this.mapWidth / 2, this.mapHeight / 2);
  }

  // Create minimap in bottom-right corner
  private createMinimap(): void {
    const minimapWidth = 120;
    const minimapHeight = 90;
    const padding = 10;
    
    // Container for minimap (fixed to screen)
    this.minimapContainer = this.add.container(0, 0);
    this.minimapContainer.setScrollFactor(0);
    this.minimapContainer.setDepth(250);
    
    // Position in bottom-right
    const posX = this.cameras.main.width - minimapWidth - padding;
    const posY = this.cameras.main.height - minimapHeight - padding;
    this.minimapContainer.setPosition(posX, posY);
    
    // Background
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.6);
    bg.fillRoundedRect(0, 0, minimapWidth, minimapHeight, 4);
    bg.lineStyle(1, 0xffffff, 0.3);
    bg.strokeRoundedRect(0, 0, minimapWidth, minimapHeight, 4);
    this.minimapContainer.add(bg);
    
    // Map graphics
    this.minimapGraphics = this.add.graphics();
    this.minimapContainer.add(this.minimapGraphics);
    
    // Draw simplified map
    this.drawMinimapTerrain(minimapWidth, minimapHeight);
    
    // Viewport indicator
    this.minimapViewport = this.add.graphics();
    this.minimapContainer.add(this.minimapViewport);
    
    // Label
    const label = this.add.text(minimapWidth / 2, 6, 'MAP', {
      fontSize: '6px',
      fontFamily: '"Press Start 2P", monospace',
      color: '#ffffff',
    });
    label.setOrigin(0.5, 0);
    label.setAlpha(0.6);
    this.minimapContainer.add(label);
  }

  private drawMinimapTerrain(width: number, height: number): void {
    const scaleX = width / this.mapWidth;
    const scaleY = height / this.mapHeight;
    
    // Draw areas as colored rectangles
    const areaColors: Record<string, number> = {
      office: 0x8898b0,
      park: 0x7ab87a,
      plaza: 0xc8b898,
      coffeeShop: 0xb8885a,
      store: 0xe0dcd0,
      residential: 0x9a8a70,
    };
    
    for (const [key, area] of Object.entries(TOWN_MAP.areas)) {
      const color = areaColors[key] ?? 0x888888;
      this.minimapGraphics.fillStyle(color, 0.7);
      this.minimapGraphics.fillRect(
        area.x * TILE_SIZE * scaleX,
        area.y * TILE_SIZE * scaleY,
        area.width * TILE_SIZE * scaleX,
        area.height * TILE_SIZE * scaleY
      );
    }
    
    // Draw roads
    this.minimapGraphics.fillStyle(0x8a8890, 0.8);
    // Main E-W road
    this.minimapGraphics.fillRect(2 * TILE_SIZE * scaleX, 13 * TILE_SIZE * scaleY, 53 * TILE_SIZE * scaleX, 2 * TILE_SIZE * scaleY);
    // Main N-S avenue
    this.minimapGraphics.fillRect(20 * TILE_SIZE * scaleX, 1 * TILE_SIZE * scaleY, 2 * TILE_SIZE * scaleX, 32 * TILE_SIZE * scaleY);
    
    // Draw water (river)
    this.minimapGraphics.fillStyle(0x3a8abb, 0.8);
    this.minimapGraphics.fillRect(0, 35 * TILE_SIZE * scaleY, width, 3 * TILE_SIZE * scaleY);
  }

  private updateMinimapViewport(): void {
    if (!this.minimapViewport) return;
    
    const cam = this.cameras.main;
    const minimapWidth = 120;
    const minimapHeight = 90;
    const scaleX = minimapWidth / this.mapWidth;
    const scaleY = minimapHeight / this.mapHeight;
    
    this.minimapViewport.clear();
    this.minimapViewport.lineStyle(1, 0xffff00, 0.8);
    this.minimapViewport.strokeRect(
      cam.scrollX * scaleX,
      cam.scrollY * scaleY,
      (cam.width / cam.zoom) * scaleX,
      (cam.height / cam.zoom) * scaleY
    );
  }

  private updateMinimapAgents(): void {
    const minimapWidth = 120;
    const minimapHeight = 90;
    const scaleX = minimapWidth / this.mapWidth;
    const scaleY = minimapHeight / this.mapHeight;
    
    // Update or create dots for each agent
    for (const [agentId, agent] of this.agents) {
      let dot = this.minimapAgentDots.get(agentId);
      if (!dot) {
        dot = this.add.graphics();
        this.minimapContainer.add(dot);
        this.minimapAgentDots.set(agentId, dot);
      }
      
      dot.clear();
      dot.fillStyle(0xff4444, 1);
      dot.fillCircle(agent.x * scaleX, agent.y * scaleY, 2);
    }
    
    // Remove dots for agents that no longer exist
    for (const [agentId, dot] of this.minimapAgentDots) {
      if (!this.agents.has(agentId)) {
        dot.destroy();
        this.minimapAgentDots.delete(agentId);
      }
    }
  }

  // Show agent detail panel
  private showAgentDetailPanel(agentId: string): void {
    this.hideAgentDetailPanel();
    
    const agent = this.agents.get(agentId);
    const data = this.agentData.get(agentId);
    if (!agent || !data) return;
    
    this.selectedAgentId = agentId;
    
    // Create panel container (fixed to screen, near agent)
    this.detailPanel = this.add.container(0, 0);
    this.detailPanel.setDepth(300);
    
    // Convert agent world position to screen position
    const screenX = (agent.x - this.cameras.main.scrollX) * this.cameras.main.zoom;
    const screenY = (agent.y - this.cameras.main.scrollY) * this.cameras.main.zoom;
    
    // Panel dimensions
    const panelWidth = 160;
    const panelHeight = 100;
    
    // Position panel above agent, clamped to screen
    let panelX = screenX - panelWidth / 2;
    let panelY = screenY - panelHeight - 40;
    panelX = Math.max(10, Math.min(this.cameras.main.width - panelWidth - 10, panelX));
    panelY = Math.max(10, Math.min(this.cameras.main.height - panelHeight - 10, panelY));
    
    this.detailPanel.setPosition(panelX, panelY);
    this.detailPanel.setScrollFactor(0);
    
    // Background
    const bg = this.add.graphics();
    bg.fillStyle(0x1a1a2e, 0.95);
    bg.fillRoundedRect(0, 0, panelWidth, panelHeight, 6);
    bg.lineStyle(2, 0x4a4a6a, 1);
    bg.strokeRoundedRect(0, 0, panelWidth, panelHeight, 6);
    this.detailPanel.add(bg);
    
    // Agent name - larger font with higher resolution
    const shortName = agentId.replace(/-/g, ' ').slice(0, 15);
    const nameText = this.add.text(panelWidth / 2, 10, shortName, {
      fontSize: '10px',
      fontFamily: '"Press Start 2P", monospace',
      color: '#ffffff',
      resolution: 2,
    });
    nameText.setOrigin(0.5, 0);
    this.detailPanel.add(nameText);
    
    // Status with color indicator - larger font
    const statusColor = data.status === 'online' ? '#44ff44' : data.status === 'idle' ? '#ffaa44' : '#888888';
    const statusText = this.add.text(12, 30, `● ${data.status.toUpperCase()}`, {
      fontSize: '9px',
      fontFamily: '"Press Start 2P", monospace',
      color: statusColor,
      resolution: 2,
    });
    this.detailPanel.add(statusText);
    
    // Activity - larger font with better contrast
    const activity = agent.getActivity();
    const activityText = this.add.text(12, 48, `Activity: ${activity}`, {
      fontSize: '8px',
      fontFamily: '"Press Start 2P", monospace',
      color: '#e0e0e0',
      resolution: 2,
    });
    this.detailPanel.add(activityText);
    
    // Location - larger font
    const location = agent.getLocation();
    const locationText = this.add.text(12, 64, `Location: ${location}`, {
      fontSize: '8px',
      fontFamily: '"Press Start 2P", monospace',
      color: '#e0e0e0',
      resolution: 2,
    });
    this.detailPanel.add(locationText);
    
    // Mood - larger font
    const mood = agent.getMood();
    const moodEmoji = mood === 'happy' ? '😊' : mood === 'focused' ? '🎯' : mood === 'tired' ? '😴' : '😐';
    const moodText = this.add.text(12, 80, `Mood: ${moodEmoji} ${mood}`, {
      fontSize: '8px',
      fontFamily: '"Press Start 2P", monospace',
      color: '#e0e0e0',
      resolution: 2,
    });
    this.detailPanel.add(moodText);
    
    // Animate panel appearance
    this.detailPanel.setScale(0);
    this.tweens.add({
      targets: this.detailPanel,
      scaleX: 1,
      scaleY: 1,
      duration: 150,
      ease: 'Back.easeOut',
    });
    
    // Notify callback
    if (agentDetailCallback) {
      agentDetailCallback(agentId, {
        agentId,
        activity,
        location,
        mood,
        status: data.status,
      });
    }
    
    // Auto-hide after 5 seconds
    this.time.delayedCall(5000, () => {
      if (this.selectedAgentId === agentId) {
        this.hideAgentDetailPanel();
      }
    });
  }

  private hideAgentDetailPanel(): void {
    if (this.detailPanel) {
      this.tweens.add({
        targets: this.detailPanel,
        scaleX: 0,
        scaleY: 0,
        duration: 100,
        onComplete: () => {
          this.detailPanel?.destroy();
          this.detailPanel = null;
        },
      });
    }
    this.selectedAgentId = null;
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

  /**
   * Start weather cycle - changes weather randomly every 2-5 minutes (game time).
   */
  private startWeatherCycle(): void {
    const changeWeather = () => {
      const newWeather = generateRandomWeather();
      this.environmentSystem.setWeather(newWeather.condition as WeatherType);
      
      // Schedule next weather change (2-5 minutes real time, affected by game speed)
      const baseDelay = 120000 + Math.random() * 180000; // 2-5 minutes
      this.weatherTimer = window.setTimeout(changeWeather, baseDelay);
    };
    
    // First weather change after 1-3 minutes
    const initialDelay = 60000 + Math.random() * 120000;
    this.weatherTimer = window.setTimeout(changeWeather, initialDelay);
  }

  /**
   * Update weather UI indicator.
   */
  private updateWeatherUI(): void {
    if (this.weatherText) {
      this.weatherText.setText(getWeatherIcon(this.currentWeather));
    }
  }

  /**
   * Handle agent behavior changes based on weather.
   * Rain/snow: agents seek shelter (office, store, coffeeShop).
   */
  private handleWeatherBehavior(weather: WeatherType): void {
    if (weather === 'rain' || weather === 'snow') {
      // Move outdoor agents to shelter
      const shelterAreas: TownArea[] = ['office', 'store', 'coffeeShop'];
      const outdoorAreas: TownArea[] = ['park', 'plaza'];
      
      for (const [agentId, agent] of this.agents) {
        const controller = this.movementControllers.get(agentId);
        if (!controller) continue;
        
        const currentLocation = agent.getLocation();
        const isOutdoor = outdoorAreas.some(area => 
          TOWN_MAP.areas[area]?.name === currentLocation
        );
        
        if (isOutdoor) {
          // Pick a random shelter
          const shelter = shelterAreas[Math.floor(Math.random() * shelterAreas.length)];
          const area = TOWN_MAP.areas[shelter];
          const targetX = area.x + 2 + Math.floor(Math.random() * (area.width - 4));
          const targetY = area.y + 2 + Math.floor(Math.random() * (area.height - 4));
          
          agent.setActivity('seeking shelter');
          controller.moveTo(targetX, targetY).then(() => {
            agent.setLocation(area.name);
            agent.setActivity('sheltering');
          });
        }
      }
    }
  }

  /**
   * Handle agent behavior at night - most agents go home.
   */
  private handleNightBehavior(hour: number): void {
    // Night time: 22:00 - 06:00
    if (hour >= 22 || hour < 6) {
      const residentialArea = TOWN_MAP.areas.residential;
      
      for (const [agentId, agent] of this.agents) {
        const controller = this.movementControllers.get(agentId);
        if (!controller) continue;
        
        // 70% chance to go home at night
        if (Math.random() < 0.7) {
          const targetX = residentialArea.x + 2 + Math.floor(Math.random() * (residentialArea.width - 4));
          const targetY = residentialArea.y + 2 + Math.floor(Math.random() * (residentialArea.height - 4));
          
          agent.setActivity('going home');
          controller.moveTo(targetX, targetY).then(() => {
            agent.setLocation(residentialArea.name);
            agent.setActivity('sleeping');
            agent.setAlpha(0.5); // Dim sleeping agents
          });
        }
      }
    } else if (hour === 6) {
      // Wake up agents at dawn
      for (const [, agent] of this.agents) {
        agent.setAlpha(1);
        agent.setActivity('waking up');
      }
    }
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

  // Focus camera on a specific agent with highlight effect
  focusOnAgent(agentId: string): void {
    const agent = this.agents.get(agentId);
    if (!agent) return;

    // Clear any existing highlight
    this.clearHighlight();

    // Pan camera to agent position
    this.cameras.main.pan(agent.x, agent.y, 500, 'Power2', false, (_cam, progress) => {
      if (progress === 1) {
        // Zoom in slightly when focused
        this.tweens.add({
          targets: this.cameras.main,
          zoom: Math.min(this.cameras.main.zoom * 1.5, 3),
          duration: 300,
          ease: 'Sine.easeOut',
        });
      }
    });

    // Create highlight effect
    this.highlightGraphics = this.add.graphics();
    this.highlightGraphics.setDepth(agent.depth - 1);

    // Pulsing circle highlight
    let radius = 20;
    const drawHighlight = () => {
      if (!this.highlightGraphics || !agent.active) return;
      this.highlightGraphics.clear();
      this.highlightGraphics.lineStyle(3, 0xffff00, 0.8);
      this.highlightGraphics.strokeCircle(agent.x, agent.y - 12, radius);
      this.highlightGraphics.lineStyle(2, 0xffffff, 0.4);
      this.highlightGraphics.strokeCircle(agent.x, agent.y - 12, radius + 4);
    };

    drawHighlight();

    // Animate the highlight
    this.highlightTween = this.tweens.add({
      targets: { radius: 20 },
      radius: 28,
      duration: 600,
      yoyo: true,
      repeat: 5,
      ease: 'Sine.easeInOut',
      onUpdate: (tween) => {
        const val = tween.getValue();
        if (typeof val === 'number') {
          radius = val;
          drawHighlight();
        }
      },
      onComplete: () => {
        this.clearHighlight();
      },
    });

    // Show detail panel
    this.showAgentDetailPanel(agentId);

    // Notify callback
    agentFocusCallback?.(agentId);
  }

  private clearHighlight(): void {
    if (this.highlightTween) {
      this.highlightTween.stop();
      this.highlightTween = null;
    }
    if (this.highlightGraphics) {
      this.highlightGraphics.destroy();
      this.highlightGraphics = null;
    }
  }

  // Get all agents for external use (e.g., AgentListPanel)
  getAgents(): Map<string, AgentSprite> {
    return this.agents;
  }

  // Get agent data for external use
  getAgentData(): Map<string, ApiAgentStatus> {
    return this.agentData;
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
    agent.on('pointerdown', () => {
      agentClickCallback?.(agentData.agent_id);
      this.showAgentDetailPanel(agentData.agent_id);
    });
    agent.on('pointerover', () => agent.setScale(1.1));
    agent.on('pointerout', () => agent.setScale(1));

    // Set agent location and activity
    agent.setLocation(area.name);
    agent.setActivity(agentData.status === 'online' ? 'working' : 'resting');
    agent.setMood(agentData.status === 'online' ? 'focused' : 'neutral');
    
    // Set wander bounds for idle animation
    agent.setWanderBounds({
      x: area.x * TILE_SIZE,
      y: area.y * TILE_SIZE,
      width: area.width * TILE_SIZE,
      height: area.height * TILE_SIZE,
    });
    
    // Face towards center of area (simulating facing desk/workstation)
    const areaCenterX = (area.x + area.width / 2) * TILE_SIZE;
    const areaCenterY = (area.y + area.height / 2) * TILE_SIZE;
    agent.faceTowards(areaCenterX, areaCenterY);

    const controller = new AgentMovementController(this, agent, this.pathfinder);
    controller.setPosition(tileX, tileY);
    this.movementControllers.set(agentData.agent_id, controller);
    this.agents.set(agentData.agent_id, agent);
    this.scheduleSystem.registerAgent(agentData.agent_id, agent, controller);
    this.socialSystem.registerAgent(agentData.agent_id, agent);
    this.meetingSystem.registerAgent(agentData.agent_id, agent, controller);
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
        agent.work();
        agent.setVisible(true);
        agent.setAlpha(1);
        agent.setActivity('working');
        agent.setMood('focused');
        agent.setWorkStatus('working');
        agent.stopWandering();
        break;
      case 'idle':
        agent.rest();
        agent.setVisible(true);
        agent.setAlpha(1);
        agent.setActivity('resting');
        agent.setMood('neutral');
        agent.setWorkStatus('idle');
        agent.startWandering(); // Start idle wandering
        break;
      case 'error':
        agent.error();
        agent.setVisible(true);
        agent.setAlpha(1);
        agent.setActivity('error');
        agent.setMood('frustrated');
        agent.setWorkStatus('error');
        agent.stopWandering();
        break;
      default:
        agent.idle();
        agent.setAlpha(0.6);
        agent.setActivity('offline');
        agent.setMood('neutral');
        agent.setWorkStatus('idle');
        agent.stopWandering();
    }
  }

  private removeAgent(agentId: string): void {
    const agent = this.agents.get(agentId);
    if (agent) { agent.destroy(); this.agents.delete(agentId); }
    this.scheduleSystem.unregisterAgent(agentId);
    this.socialSystem.unregisterAgent(agentId);
    this.meetingSystem.unregisterAgent(agentId);
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
    this.environmentSystem.update();
    this.scheduleSystem.update();
    this.socialSystem.update();
    this.meetingSystem.update();
    this.performanceManager.update();
    this.timeText.setText(this.gameTime.getTimeString());
    this.agents.forEach(agent => agent.updateDepth());
    for (const pet of this.pets) pet.update(_time, delta);
    this.checkPetInteractions();
    
    // Update minimap
    this.updateMinimapViewport();
    this.updateMinimapAgents();
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
    if (this.weatherTimer !== null) { clearTimeout(this.weatherTimer); this.weatherTimer = null; }
    this.gameTime.destroy();
    this.dayNightCycle.destroy();
    this.environmentSystem.destroy();
    this.scheduleSystem.destroy();
    this.socialSystem.destroy();
    this.meetingSystem.destroy();
    this.performanceManager.destroy();
    this.touchInput.destroy();
    
    // Clean up minimap
    this.minimapAgentDots.forEach(dot => dot.destroy());
    this.minimapAgentDots.clear();
    
    // Clean up detail panel
    this.hideAgentDetailPanel();
    
    // Clean up highlight
    this.clearHighlight();
  }

  // Public getters for weather
  getWeather(): WeatherType { return this.currentWeather; }
  setWeather(weather: WeatherType): void { this.environmentSystem.setWeather(weather); }

  getPerformanceStats() { return this.performanceManager.getStats(); }
  setZoom(zoom: number): void { this.touchInput.setZoom(zoom); }
  getZoom(): number { return this.touchInput.getZoom(); }
}
