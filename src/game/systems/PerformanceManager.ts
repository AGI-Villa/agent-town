import Phaser from 'phaser';
import { AgentSprite } from '../sprites';
import { TILE_SIZE } from '../tiles/tileset-generator';

export interface PerformanceConfig {
  viewportPadding: number;      // Extra tiles around viewport to render
  cullingEnabled: boolean;      // Enable viewport culling
  dynamicFrameRate: boolean;    // Adjust animation frame rate based on agent count
  maxFullRenderAgents: number;  // Above this, use simplified rendering
  lowDetailDistance: number;    // Distance from viewport center for low detail
}

const DEFAULT_CONFIG: PerformanceConfig = {
  viewportPadding: 2,
  cullingEnabled: true,
  dynamicFrameRate: true,
  maxFullRenderAgents: 15,
  lowDetailDistance: 300,
};

interface AgentRenderState {
  sprite: AgentSprite;
  isVisible: boolean;
  isLowDetail: boolean;
  lastUpdate: number;
}

export class PerformanceManager {
  private scene: Phaser.Scene;
  private config: PerformanceConfig;
  private agents: Map<string, AgentRenderState> = new Map();
  private frameSkip: number = 0;
  private currentFrameSkip: number = 0;
  private lastCullCheck: number = 0;
  private cullCheckInterval: number = 100; // ms

  constructor(scene: Phaser.Scene, config: Partial<PerformanceConfig> = {}) {
    this.scene = scene;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  registerAgent(agentId: string, sprite: AgentSprite): void {
    this.agents.set(agentId, {
      sprite,
      isVisible: true,
      isLowDetail: false,
      lastUpdate: Date.now(),
    });
    this.updateFrameSkip();
  }

  unregisterAgent(agentId: string): void {
    this.agents.delete(agentId);
    this.updateFrameSkip();
  }

  private updateFrameSkip(): void {
    if (!this.config.dynamicFrameRate) {
      this.frameSkip = 0;
      return;
    }

    const count = this.agents.size;
    if (count <= this.config.maxFullRenderAgents) {
      this.frameSkip = 0;
    } else if (count <= 30) {
      this.frameSkip = 1; // Skip every other frame
    } else if (count <= 50) {
      this.frameSkip = 2; // Skip 2 of 3 frames
    } else {
      this.frameSkip = 3; // Skip 3 of 4 frames
    }
  }

  update(): void {
    const now = Date.now();
    
    // Throttle culling checks
    if (now - this.lastCullCheck < this.cullCheckInterval) {
      return;
    }
    this.lastCullCheck = now;

    if (this.config.cullingEnabled) {
      this.performViewportCulling();
    }

    // Frame skip for animations
    this.currentFrameSkip = (this.currentFrameSkip + 1) % (this.frameSkip + 1);
  }

  private performViewportCulling(): void {
    const cam = this.scene.cameras.main;
    const padding = this.config.viewportPadding * TILE_SIZE;
    
    const viewLeft = cam.scrollX - padding;
    const viewRight = cam.scrollX + cam.width + padding;
    const viewTop = cam.scrollY - padding;
    const viewBottom = cam.scrollY + cam.height + padding;
    
    const viewCenterX = cam.scrollX + cam.width / 2;
    const viewCenterY = cam.scrollY + cam.height / 2;

    for (const [, state] of this.agents) {
      const sprite = state.sprite;
      const x = sprite.x;
      const y = sprite.y;

      // Check if in viewport
      const inViewport = x >= viewLeft && x <= viewRight && y >= viewTop && y <= viewBottom;
      
      if (inViewport !== state.isVisible) {
        state.isVisible = inViewport;
        sprite.setVisible(inViewport);
      }

      // Check distance for detail level
      if (inViewport) {
        const dx = x - viewCenterX;
        const dy = y - viewCenterY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const shouldBeLowDetail = distance > this.config.lowDetailDistance;
        
        if (shouldBeLowDetail !== state.isLowDetail) {
          state.isLowDetail = shouldBeLowDetail;
          this.setAgentDetailLevel(sprite, shouldBeLowDetail);
        }
      }
    }
  }

  private setAgentDetailLevel(sprite: AgentSprite, lowDetail: boolean): void {
    if (lowDetail) {
      sprite.setAlpha(0.8);
      // Could also reduce animation frame rate here
    } else {
      sprite.setAlpha(1);
    }
  }

  shouldUpdateAnimation(): boolean {
    return this.currentFrameSkip === 0;
  }

  getStats(): { total: number; visible: number; lowDetail: number; frameSkip: number } {
    let visible = 0;
    let lowDetail = 0;
    
    for (const [, state] of this.agents) {
      if (state.isVisible) visible++;
      if (state.isLowDetail) lowDetail++;
    }

    return {
      total: this.agents.size,
      visible,
      lowDetail,
      frameSkip: this.frameSkip,
    };
  }

  destroy(): void {
    this.agents.clear();
  }
}
