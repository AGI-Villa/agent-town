import Phaser from 'phaser';

// Animation states for agents
export type AnimationState = 
  | 'idle_down'
  | 'idle_up'
  | 'idle_left'
  | 'idle_right'
  | 'walk_down'
  | 'walk_up'
  | 'walk_left'
  | 'walk_right'
  | 'work'
  | 'think'
  | 'rest'
  | 'error';

export type Direction = 'up' | 'down' | 'left' | 'right';

// Animation frame definitions
export interface AnimationDef {
  key: string;
  frames: number[];
  frameRate: number;
  repeat: number; // -1 for infinite
}

// Sprite sheet layout (16x24 per frame)
// Row 0: Walk down (4 frames)
// Row 1: Walk up (4 frames)
// Row 2: Walk left (4 frames)
// Row 3: Walk right (4 frames)
// Row 4: Work (2 frames), Think (2 frames), Rest (2 frames), Error (2 frames)
export const SPRITE_CONFIG = {
  frameWidth: 16,
  frameHeight: 24,
  framesPerRow: 8,
  rows: 5,
};

// Animation definitions
export const ANIMATION_DEFS: Record<AnimationState, AnimationDef> = {
  idle_down: { key: 'idle_down', frames: [0], frameRate: 1, repeat: 0 },
  idle_up: { key: 'idle_up', frames: [8], frameRate: 1, repeat: 0 },
  idle_left: { key: 'idle_left', frames: [16], frameRate: 1, repeat: 0 },
  idle_right: { key: 'idle_right', frames: [24], frameRate: 1, repeat: 0 },
  walk_down: { key: 'walk_down', frames: [0, 1, 2, 3], frameRate: 8, repeat: -1 },
  walk_up: { key: 'walk_up', frames: [8, 9, 10, 11], frameRate: 8, repeat: -1 },
  walk_left: { key: 'walk_left', frames: [16, 17, 18, 19], frameRate: 8, repeat: -1 },
  walk_right: { key: 'walk_right', frames: [24, 25, 26, 27], frameRate: 8, repeat: -1 },
  work: { key: 'work', frames: [32, 33], frameRate: 4, repeat: -1 },
  think: { key: 'think', frames: [34, 35], frameRate: 2, repeat: -1 },
  rest: { key: 'rest', frames: [36, 37], frameRate: 2, repeat: -1 },
  error: { key: 'error', frames: [38, 39], frameRate: 6, repeat: -1 },
};

export class AnimationManager {
  private scene: Phaser.Scene;
  private currentState: AnimationState = 'idle_down';
  private direction: Direction = 'down';
  private registeredKeys: Set<string> = new Set();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  // Register animations for a specific agent color variant
  registerAnimations(textureKey: string): void {
    if (this.registeredKeys.has(textureKey)) return;

    Object.entries(ANIMATION_DEFS).forEach(([state, def]) => {
      const animKey = `${textureKey}_${state}`;
      
      if (!this.scene.anims.exists(animKey)) {
        this.scene.anims.create({
          key: animKey,
          frames: def.frames.map(frame => ({ key: textureKey, frame })),
          frameRate: def.frameRate,
          repeat: def.repeat,
        });
      }
    });

    this.registeredKeys.add(textureKey);
  }

  // Get animation key for current state
  getAnimationKey(textureKey: string, state: AnimationState): string {
    return `${textureKey}_${state}`;
  }

  // Get idle state for a direction
  getIdleState(direction: Direction): AnimationState {
    return `idle_${direction}` as AnimationState;
  }

  // Get walk state for a direction
  getWalkState(direction: Direction): AnimationState {
    return `walk_${direction}` as AnimationState;
  }

  // Determine direction from velocity
  getDirectionFromVelocity(vx: number, vy: number): Direction {
    if (Math.abs(vx) > Math.abs(vy)) {
      return vx > 0 ? 'right' : 'left';
    }
    return vy > 0 ? 'down' : 'up';
  }

  get state(): AnimationState {
    return this.currentState;
  }

  set state(newState: AnimationState) {
    this.currentState = newState;
  }

  get facing(): Direction {
    return this.direction;
  }

  set facing(dir: Direction) {
    this.direction = dir;
  }
}
