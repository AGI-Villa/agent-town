import Phaser from 'phaser';
import { AgentSprite, Direction } from '../sprites';
import { PathfindingManager, PathNode } from './PathfindingManager';
import { TILE_SIZE } from '../tiles/tileset-generator';

export type AgentStatus = 'online' | 'working' | 'idle' | 'error' | 'offline';

export interface AgentMovementConfig {
  speed: number; // tiles per second
  smoothing: boolean;
}

const DEFAULT_CONFIG: AgentMovementConfig = {
  speed: 2, // 2 tiles per second (slower, more natural movement)
  smoothing: true,
};

// Minimum time between movement steps to prevent teleporting
const MIN_STEP_DURATION_MS = 400;

export class AgentMovementController {
  private scene: Phaser.Scene;
  private sprite: AgentSprite;
  private pathfinder: PathfindingManager;
  private config: AgentMovementConfig;
  
  private currentPath: PathNode[] = [];
  private pathIndex: number = 0;
  private isMoving: boolean = false;
  private currentTween?: Phaser.Tweens.Tween;
  
  private currentTileX: number = 0;
  private currentTileY: number = 0;
  private targetTileX: number = 0;
  private targetTileY: number = 0;
  private isStepInProgress: boolean = false;

  constructor(
    scene: Phaser.Scene,
    sprite: AgentSprite,
    pathfinder: PathfindingManager,
    config: Partial<AgentMovementConfig> = {}
  ) {
    this.scene = scene;
    this.sprite = sprite;
    this.pathfinder = pathfinder;
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Initialize current tile position from sprite position
    this.updateTilePosition();
  }

  // Update tile position from sprite world position
  private updateTilePosition(): void {
    this.currentTileX = Math.floor(this.sprite.x / TILE_SIZE);
    this.currentTileY = Math.floor((this.sprite.y - TILE_SIZE / 2) / TILE_SIZE);
  }

  // Get current tile position
  getTilePosition(): { x: number; y: number } {
    return { x: this.currentTileX, y: this.currentTileY };
  }

  // Move to a specific tile
  async moveTo(targetX: number, targetY: number): Promise<boolean> {
    // Cancel any existing movement
    this.stopMovement();

    // Update current position
    this.updateTilePosition();

    // Check if already at target
    if (this.currentTileX === targetX && this.currentTileY === targetY) {
      return true;
    }

    // Validate target is walkable
    if (!this.pathfinder.isWalkable(targetX, targetY)) {
      // Find nearest walkable tile
      const nearest = this.pathfinder.findNearestWalkable(targetX, targetY, this.sprite.getAgentId());
      if (!nearest) {
        return false;
      }
      targetX = nearest.x;
      targetY = nearest.y;
    }

    // Find path
    const path = await this.pathfinder.findPathAsync(
      this.currentTileX,
      this.currentTileY,
      targetX,
      targetY
    );

    if (!path || path.length === 0) {
      return false;
    }

    // Store path and start moving
    this.currentPath = path;
    this.pathIndex = 0;
    this.targetTileX = targetX;
    this.targetTileY = targetY;
    this.isMoving = true;

    // Occupy target tile
    this.pathfinder.occupyTile(targetX, targetY, this.sprite.getAgentId());

    // Start following path
    await this.followPath();

    return true;
  }

  // Follow the current path step by step (no skipping)
  private async followPath(): Promise<void> {
    while (this.pathIndex < this.currentPath.length && this.isMoving) {
      // Prevent concurrent step execution
      if (this.isStepInProgress) {
        await new Promise(resolve => setTimeout(resolve, 50));
        continue;
      }
      
      const nextNode = this.currentPath[this.pathIndex];
      
      // Validate next tile is still walkable (collision check)
      if (!this.pathfinder.isWalkable(nextNode.x, nextNode.y)) {
        // Path blocked, stop at current position
        this.isMoving = false;
        this.sprite.idle();
        return;
      }
      
      // Determine direction
      const dx = nextNode.x - this.currentTileX;
      const dy = nextNode.y - this.currentTileY;
      const direction = this.getDirectionFromDelta(dx, dy);
      
      // Play walk animation
      this.sprite.walk(direction);

      // Move to next tile (wait for completion before next step)
      this.isStepInProgress = true;
      await this.moveToTile(nextNode.x, nextNode.y);
      this.isStepInProgress = false;
      
      // Update current position only after tween completes
      this.currentTileX = nextNode.x;
      this.currentTileY = nextNode.y;
      this.pathIndex++;
    }

    // Arrived at destination
    if (this.isMoving) {
      this.isMoving = false;
      this.sprite.idle();
    }
  }

  // Move sprite to a specific tile with smooth tween animation
  private moveToTile(tileX: number, tileY: number): Promise<void> {
    return new Promise((resolve) => {
      const targetX = tileX * TILE_SIZE + TILE_SIZE / 2;
      const targetY = (tileY + 1) * TILE_SIZE; // +1 because sprite origin is bottom

      // Calculate duration: ensure minimum step time to prevent teleporting
      const baseDuration = 1000 / this.config.speed; // ms per tile
      const duration = Math.max(baseDuration, MIN_STEP_DURATION_MS);

      // Stop any existing tween before starting new one
      if (this.currentTween) {
        this.currentTween.stop();
        this.currentTween = undefined;
      }

      this.currentTween = this.scene.tweens.add({
        targets: this.sprite,
        x: targetX,
        y: targetY,
        duration,
        ease: 'Linear', // Linear for consistent walking speed
        onUpdate: () => {
          this.sprite.updateDepth();
        },
        onComplete: () => {
          this.currentTween = undefined;
          resolve();
        },
      });
    });
  }

  // Get direction from delta
  private getDirectionFromDelta(dx: number, dy: number): Direction {
    if (Math.abs(dx) > Math.abs(dy)) {
      return dx > 0 ? 'right' : 'left';
    }
    return dy > 0 ? 'down' : 'up';
  }

  // Stop current movement - smoothly complete to nearest tile instead of snapping
  stopMovement(): void {
    this.isMoving = false;
    this.isStepInProgress = false;
    
    if (this.currentTween) {
      const progress = this.currentTween.progress;
      
      // Stop the current tween
      this.currentTween.stop();
      this.currentTween = undefined;
      
      if (progress > 0.5) {
        // More than halfway - complete to the next tile smoothly
        const nextNode = this.currentPath[this.pathIndex];
        if (nextNode) {
          const targetX = nextNode.x * TILE_SIZE + TILE_SIZE / 2;
          const targetY = (nextNode.y + 1) * TILE_SIZE;
          
          this.scene.tweens.add({
            targets: this.sprite,
            x: targetX,
            y: targetY,
            duration: 100,
            ease: 'Linear',
            onComplete: () => {
              this.currentTileX = nextNode.x;
              this.currentTileY = nextNode.y;
              this.sprite.idle();
            },
          });
        } else {
          this.sprite.idle();
        }
      } else {
        // Less than halfway - go back to current tile smoothly
        const currentTilePixelX = this.currentTileX * TILE_SIZE + TILE_SIZE / 2;
        const currentTilePixelY = (this.currentTileY + 1) * TILE_SIZE;
        
        this.scene.tweens.add({
          targets: this.sprite,
          x: currentTilePixelX,
          y: currentTilePixelY,
          duration: 100,
          ease: 'Linear',
          onComplete: () => {
            this.sprite.idle();
          },
        });
      }
    } else {
      this.sprite.idle();
    }

    // Release previously occupied tile if different from current
    if (this.targetTileX !== this.currentTileX || this.targetTileY !== this.currentTileY) {
      this.pathfinder.releaseTile(this.targetTileX, this.targetTileY);
    }

    this.currentPath = [];
    this.pathIndex = 0;
  }

  // Check if currently moving
  getIsMoving(): boolean {
    return this.isMoving;
  }

  // Get remaining path length
  getRemainingPathLength(): number {
    return Math.max(0, this.currentPath.length - this.pathIndex);
  }

  // Set position directly (for initialization only, not during gameplay)
  setPosition(tileX: number, tileY: number, animate: boolean = false): void {
    // Stop any existing movement first
    if (this.currentTween) {
      this.currentTween.stop();
      this.currentTween = undefined;
    }
    this.isMoving = false;
    this.isStepInProgress = false;
    
    const targetPixelX = tileX * TILE_SIZE + TILE_SIZE / 2;
    const targetPixelY = (tileY + 1) * TILE_SIZE;
    
    if (animate && this.scene) {
      // Smooth transition for position updates during gameplay
      this.scene.tweens.add({
        targets: this.sprite,
        x: targetPixelX,
        y: targetPixelY,
        duration: 200,
        ease: 'Linear',
        onUpdate: () => {
          this.sprite.updateDepth();
        },
        onComplete: () => {
          this.currentTileX = tileX;
          this.currentTileY = tileY;
        },
      });
    } else {
      // Direct set for initialization
      this.currentTileX = tileX;
      this.currentTileY = tileY;
      this.sprite.setPosition(targetPixelX, targetPixelY);
      this.sprite.updateDepth();
    }
  }

  // Destroy controller
  destroy(): void {
    this.stopMovement();
    this.pathfinder.releaseTile(this.currentTileX, this.currentTileY);
  }
}
