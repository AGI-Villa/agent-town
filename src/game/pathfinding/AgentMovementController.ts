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
  speed: 2, // 2 tiles per second
  smoothing: true,
};

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

  // Follow the current path
  private async followPath(): Promise<void> {
    while (this.pathIndex < this.currentPath.length && this.isMoving) {
      const nextNode = this.currentPath[this.pathIndex];
      
      // Determine direction
      const dx = nextNode.x - this.currentTileX;
      const dy = nextNode.y - this.currentTileY;
      const direction = this.getDirectionFromDelta(dx, dy);
      
      // Play walk animation
      this.sprite.walk(direction);

      // Move to next tile
      await this.moveToTile(nextNode.x, nextNode.y);
      
      // Update current position
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

  // Move sprite to a specific tile with animation
  private moveToTile(tileX: number, tileY: number): Promise<void> {
    return new Promise((resolve) => {
      const targetX = tileX * TILE_SIZE + TILE_SIZE / 2;
      const targetY = (tileY + 1) * TILE_SIZE; // +1 because sprite origin is bottom

      const duration = (1000 / this.config.speed); // ms per tile

      this.currentTween = this.scene.tweens.add({
        targets: this.sprite,
        x: targetX,
        y: targetY,
        duration,
        ease: this.config.smoothing ? 'Linear' : 'Steps(1)',
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

  // Stop current movement
  stopMovement(): void {
    this.isMoving = false;
    
    if (this.currentTween) {
      this.currentTween.stop();
      this.currentTween = undefined;
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

  // Set position directly (for initialization)
  setPosition(tileX: number, tileY: number): void {
    this.currentTileX = tileX;
    this.currentTileY = tileY;
    this.sprite.setPosition(
      tileX * TILE_SIZE + TILE_SIZE / 2,
      (tileY + 1) * TILE_SIZE
    );
    this.sprite.updateDepth();
  }

  // Destroy controller
  destroy(): void {
    this.stopMovement();
    this.pathfinder.releaseTile(this.currentTileX, this.currentTileY);
  }
}
