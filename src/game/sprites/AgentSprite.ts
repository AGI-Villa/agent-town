import Phaser from 'phaser';
import { PICO8_COLORS } from '../tiles/palette';
import { 
  AnimationManager, 
  AnimationState, 
  Direction,
  SPRITE_CONFIG,
  ANIMATION_DEFS 
} from './AnimationManager';

// Pico-8 colors for agent variants (based on agent_id hash)
const AGENT_COLORS = [
  PICO8_COLORS.blue,
  PICO8_COLORS.red,
  PICO8_COLORS.green,
  PICO8_COLORS.orange,
  PICO8_COLORS.pink,
  PICO8_COLORS.yellow,
  PICO8_COLORS.lavender,
  PICO8_COLORS.peach,
];

// Simple hash function for agent_id
function hashAgentId(agentId: string): number {
  let hash = 0;
  for (let i = 0; i < agentId.length; i++) {
    const char = agentId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

export type AgentWorkStatus = 'working' | 'thinking' | 'idle' | 'error';

export class AgentSprite extends Phaser.GameObjects.Container {
  private sprite: Phaser.GameObjects.Sprite;
  private animManager: AnimationManager;
  private agentId: string;
  private colorIndex: number;
  private textureKey: string;
  private currentState: AnimationState = 'idle_down';
  private statusIndicator?: Phaser.GameObjects.Graphics;
  private nameLabel: Phaser.GameObjects.Text | null = null;
  private statusIcon: Phaser.GameObjects.Text | null = null;
  private workStatus: AgentWorkStatus = 'idle';
  
  // Idle wandering state
  private isWandering = false;
  private wanderTimer: Phaser.Time.TimerEvent | null = null;
  private wanderBounds: { x: number; y: number; width: number; height: number } | null = null;
  private originalPosition: { x: number; y: number } | null = null;
  
  // Activity state for detail panel
  private currentActivity = 'idle';
  private currentMood = 'neutral';
  private currentLocation = 'unknown';

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    agentId: string
  ) {
    super(scene, x, y);

    this.agentId = agentId;
    this.colorIndex = hashAgentId(agentId) % AGENT_COLORS.length;
    this.textureKey = `agent_${this.colorIndex}`;
    this.animManager = new AnimationManager(scene);

    // Generate sprite texture if not exists
    this.generateSpriteTexture();

    // Register animations
    this.animManager.registerAnimations(this.textureKey);

    // Create sprite
    this.sprite = scene.add.sprite(0, 0, this.textureKey, 0);
    this.sprite.setOrigin(0.5, 1); // Bottom center origin for proper positioning
    this.sprite.setScale(1.5); // Increase sprite size for better visibility
    this.add(this.sprite);

    // Create status indicator (for think/error bubbles)
    this.statusIndicator = scene.add.graphics();
    this.statusIndicator.setPosition(0, -SPRITE_CONFIG.frameHeight * 1.5 - 4);
    this.add(this.statusIndicator);

    // Name label above head - higher resolution for clarity
    const shortName = agentId.replace(/-/g, '').toUpperCase().slice(0, 5);
    this.nameLabel = scene.add.text(0, -SPRITE_CONFIG.frameHeight * 1.5 - 10, shortName, {
      fontSize: '10px',
      fontFamily: '"Press Start 2P", monospace',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
      resolution: 2,
    });
    this.nameLabel.setOrigin(0.5, 1);
    this.add(this.nameLabel);

    // Status icon above name (emoji-based) - higher resolution
    this.statusIcon = scene.add.text(0, -SPRITE_CONFIG.frameHeight * 1.5 - 26, '☕', {
      fontSize: '18px',
      fontFamily: 'Arial, sans-serif',
      resolution: 2,
    });
    this.statusIcon.setOrigin(0.5, 1);
    this.add(this.statusIcon);

    // Set depth based on y position
    this.setDepth(y);

    // Add to scene
    scene.add.existing(this);

    // Play initial animation
    this.playAnimation('idle_down');
  }

  private generateSpriteTexture(): void {
    if (this.scene.textures.exists(this.textureKey)) return;

    const { frameWidth, frameHeight, framesPerRow, rows } = SPRITE_CONFIG;
    const width = frameWidth * framesPerRow;
    const height = frameHeight * rows;
    const color = AGENT_COLORS[this.colorIndex];

    const graphics = this.scene.add.graphics();
    
    // Generate all frames
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < framesPerRow; col++) {
        const x = col * frameWidth;
        const y = row * frameHeight;
        this.drawAgentFrame(graphics, x, y, row, col, color);
      }
    }

    // Generate texture from graphics
    graphics.generateTexture(this.textureKey, width, height);
    graphics.destroy();

    // Register individual frames so Phaser can address them by index (0-39).
    // Without this, the entire spritesheet is treated as a single frame.
    const texture = this.scene.textures.get(this.textureKey);
    let frameIndex = 0;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < framesPerRow; col++) {
        texture.add(
          frameIndex,
          0,
          col * frameWidth,
          row * frameHeight,
          frameWidth,
          frameHeight
        );
        frameIndex++;
      }
    }
  }

  private drawAgentFrame(
    graphics: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    row: number,
    col: number,
    color: number
  ): void {
    const fw = SPRITE_CONFIG.frameWidth;
    const fh = SPRITE_CONFIG.frameHeight;

    // Clear area
    graphics.fillStyle(0x000000, 0);
    graphics.fillRect(x, y, fw, fh);

    // Body color
    const bodyColor = color;
    const skinColor = PICO8_COLORS.peach;
    const hairColor = PICO8_COLORS.brown;
    const shoeColor = PICO8_COLORS.darkGray;

    if (row < 4) {
      // Walking animations (rows 0-3)
      const direction = row; // 0=down, 1=up, 2=left, 3=right
      const frame = col % 4;
      this.drawWalkFrame(graphics, x, y, direction, frame, bodyColor, skinColor, hairColor, shoeColor);
    } else {
      // Special animations (row 4)
      const animType = Math.floor(col / 2); // 0=work, 1=think, 2=rest, 3=error
      const frame = col % 2;
      this.drawSpecialFrame(graphics, x, y, animType, frame, bodyColor, skinColor, hairColor, shoeColor);
    }
  }

  private drawWalkFrame(
    graphics: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    direction: number,
    frame: number,
    bodyColor: number,
    skinColor: number,
    hairColor: number,
    shoeColor: number
  ): void {
    // Leg offset for walking animation
    const legOffset = frame === 1 || frame === 3 ? 1 : 0;
    const armOffset = frame === 0 || frame === 2 ? 1 : -1;

    // Head (6x6)
    graphics.fillStyle(skinColor);
    graphics.fillRect(x + 5, y + 2, 6, 6);

    // Hair
    graphics.fillStyle(hairColor);
    if (direction === 0) {
      // Facing down - no hair visible
    } else if (direction === 1) {
      // Facing up - full hair
      graphics.fillRect(x + 5, y + 1, 6, 3);
    } else {
      // Side view - partial hair
      graphics.fillRect(x + 5, y + 1, 6, 2);
    }

    // Eyes (only when facing down or sides)
    if (direction !== 1) {
      graphics.fillStyle(PICO8_COLORS.black);
      if (direction === 0) {
        // Facing down
        graphics.fillRect(x + 6, y + 4, 1, 1);
        graphics.fillRect(x + 9, y + 4, 1, 1);
      } else if (direction === 2) {
        // Facing left
        graphics.fillRect(x + 5, y + 4, 1, 1);
      } else {
        // Facing right
        graphics.fillRect(x + 10, y + 4, 1, 1);
      }
    }

    // Body (8x8)
    graphics.fillStyle(bodyColor);
    graphics.fillRect(x + 4, y + 8, 8, 8);

    // Arms
    graphics.fillStyle(skinColor);
    if (direction === 2) {
      // Left facing - one arm visible
      graphics.fillRect(x + 11, y + 9 + armOffset, 2, 4);
    } else if (direction === 3) {
      // Right facing - one arm visible
      graphics.fillRect(x + 3, y + 9 + armOffset, 2, 4);
    } else {
      // Front/back - both arms
      graphics.fillRect(x + 2, y + 9 + armOffset, 2, 4);
      graphics.fillRect(x + 12, y + 9 - armOffset, 2, 4);
    }

    // Legs
    graphics.fillStyle(PICO8_COLORS.darkBlue);
    graphics.fillRect(x + 5, y + 16, 3, 5 + legOffset);
    graphics.fillRect(x + 8, y + 16, 3, 5 - legOffset);

    // Shoes
    graphics.fillStyle(shoeColor);
    graphics.fillRect(x + 4, y + 21 + legOffset, 4, 2);
    graphics.fillRect(x + 8, y + 21 - legOffset, 4, 2);
  }

  private drawSpecialFrame(
    graphics: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    animType: number,
    frame: number,
    bodyColor: number,
    skinColor: number,
    hairColor: number,
    shoeColor: number
  ): void {
    // Base character (facing down, sitting/standing)
    // Head
    graphics.fillStyle(skinColor);
    graphics.fillRect(x + 5, y + 2, 6, 6);

    // Hair
    graphics.fillStyle(hairColor);

    // Eyes
    graphics.fillStyle(PICO8_COLORS.black);
    graphics.fillRect(x + 6, y + 4, 1, 1);
    graphics.fillRect(x + 9, y + 4, 1, 1);

    // Body
    graphics.fillStyle(bodyColor);
    graphics.fillRect(x + 4, y + 8, 8, 8);

    // Legs (sitting for work/rest)
    graphics.fillStyle(PICO8_COLORS.darkBlue);
    
    if (animType === 0 || animType === 2) {
      // Sitting (work/rest)
      graphics.fillRect(x + 4, y + 16, 8, 3);
      graphics.fillStyle(shoeColor);
      graphics.fillRect(x + 3, y + 19, 4, 2);
      graphics.fillRect(x + 9, y + 19, 4, 2);
    } else {
      // Standing (think/error)
      graphics.fillRect(x + 5, y + 16, 3, 5);
      graphics.fillRect(x + 8, y + 16, 3, 5);
      graphics.fillStyle(shoeColor);
      graphics.fillRect(x + 4, y + 21, 4, 2);
      graphics.fillRect(x + 8, y + 21, 4, 2);
    }

    // Animation-specific details
    switch (animType) {
      case 0: // Work - typing animation
        // Arms on keyboard
        graphics.fillStyle(skinColor);
        const armY = frame === 0 ? 12 : 13;
        graphics.fillRect(x + 2, y + armY, 3, 3);
        graphics.fillRect(x + 11, y + armY, 3, 3);
        break;

      case 1: // Think - bubble animation
        graphics.fillStyle(skinColor);
        graphics.fillRect(x + 2, y + 10, 2, 4);
        graphics.fillRect(x + 12, y + 10, 2, 4);
        // Thought bubble dots
        graphics.fillStyle(PICO8_COLORS.white);
        if (frame === 1) {
          graphics.fillRect(x + 13, y + 1, 2, 2);
          graphics.fillRect(x + 14, y - 1, 1, 1);
        }
        break;

      case 2: // Rest - coffee cup
        graphics.fillStyle(skinColor);
        graphics.fillRect(x + 2, y + 10, 2, 4);
        // Arm holding cup
        graphics.fillRect(x + 11, y + 9, 3, 4);
        // Coffee cup
        graphics.fillStyle(PICO8_COLORS.white);
        graphics.fillRect(x + 13, y + 8, 3, 4);
        graphics.fillStyle(PICO8_COLORS.brown);
        graphics.fillRect(x + 13, y + 9, 3, 2);
        // Steam
        if (frame === 1) {
          graphics.fillStyle(PICO8_COLORS.lightGray);
          graphics.fillRect(x + 14, y + 5, 1, 2);
        }
        break;

      case 3: // Error - fire/frustration
        graphics.fillStyle(skinColor);
        graphics.fillRect(x + 2, y + 9, 2, 4);
        graphics.fillRect(x + 12, y + 9, 2, 4);
        // Angry eyes
        graphics.fillStyle(PICO8_COLORS.red);
        graphics.fillRect(x + 6, y + 4, 1, 1);
        graphics.fillRect(x + 9, y + 4, 1, 1);
        // Fire above head
        graphics.fillStyle(PICO8_COLORS.red);
        graphics.fillRect(x + 6, y - 1, 4, 2);
        if (frame === 1) {
          graphics.fillStyle(PICO8_COLORS.orange);
          graphics.fillRect(x + 7, y - 3, 2, 2);
          graphics.fillStyle(PICO8_COLORS.yellow);
          graphics.fillRect(x + 7, y - 4, 2, 1);
        }
        break;
    }
  }

  // Play animation by state - only switch when state actually changes
  playAnimation(state: AnimationState): void {
    // Skip if already playing this exact animation
    const animKey = this.animManager.getAnimationKey(this.textureKey, state);
    const currentAnimKey = this.sprite.anims.currentAnim?.key;
    
    if (currentAnimKey === animKey && this.sprite.anims.isPlaying) {
      return;
    }
    
    this.currentState = state;
    this.animManager.state = state;
    
    this.sprite.play(animKey);

    // Update status indicator
    this.updateStatusIndicator(state);
  }

  // Update status indicator based on state
  private updateStatusIndicator(state: AnimationState): void {
    if (!this.statusIndicator) return;
    
    this.statusIndicator.clear();

    if (state === 'think') {
      // Draw thought bubble
      this.statusIndicator.fillStyle(PICO8_COLORS.white);
      this.statusIndicator.fillCircle(0, -8, 6);
      this.statusIndicator.fillCircle(-2, -2, 2);
      this.statusIndicator.fillCircle(-4, 2, 1);
    } else if (state === 'error') {
      // Draw exclamation mark
      this.statusIndicator.fillStyle(PICO8_COLORS.red);
      this.statusIndicator.fillRect(-1, -12, 2, 6);
      this.statusIndicator.fillRect(-1, -4, 2, 2);
    }
  }

  // Movement methods
  setDirection(direction: Direction): void {
    this.animManager.facing = direction;
  }

  walk(direction: Direction): void {
    this.setDirection(direction);
    this.playAnimation(this.animManager.getWalkState(direction));
  }

  idle(): void {
    this.playAnimation(this.animManager.getIdleState(this.animManager.facing));
  }

  work(): void {
    this.playAnimation('work');
  }

  think(): void {
    this.playAnimation('think');
  }

  rest(): void {
    this.playAnimation('rest');
  }

  error(): void {
    this.playAnimation('error');
  }

  // Update depth based on y position (for proper layering)
  updateDepth(): void {
    this.setDepth(this.y);
  }

  // Getters
  getAgentId(): string {
    return this.agentId;
  }

  getColorIndex(): number {
    return this.colorIndex;
  }

  getCurrentState(): AnimationState {
    return this.currentState;
  }

  // Face towards a specific point (for facing desks/workstations)
  faceTowards(targetX: number, targetY: number): void {
    const dx = targetX - this.x;
    const dy = targetY - this.y;
    
    // Determine primary direction based on larger delta
    if (Math.abs(dx) > Math.abs(dy)) {
      this.setDirection(dx > 0 ? 'right' : 'left');
    } else {
      this.setDirection(dy > 0 ? 'down' : 'up');
    }
    this.idle();
  }

  // Set wander bounds for idle animation
  setWanderBounds(bounds: { x: number; y: number; width: number; height: number }): void {
    this.wanderBounds = bounds;
    this.originalPosition = { x: this.x, y: this.y };
  }

  // Start idle wandering animation
  startWandering(): void {
    if (this.isWandering || !this.wanderBounds) return;
    this.isWandering = true;
    this.scheduleNextWander();
  }

  // Stop idle wandering
  stopWandering(): void {
    this.isWandering = false;
    if (this.wanderTimer) {
      this.wanderTimer.destroy();
      this.wanderTimer = null;
    }
    // Kill any active wander tweens on this container
    this.scene.tweens.killTweensOf(this);
  }

  private scheduleNextWander(): void {
    if (!this.isWandering) return;
    
    // Random delay between 2-5 seconds
    const delay = 2000 + Math.random() * 3000;
    
    this.wanderTimer = this.scene.time.delayedCall(delay, () => {
      if (!this.isWandering || !this.wanderBounds) return;
      this.performWander();
    });
  }

  private performWander(): void {
    if (!this.wanderBounds || !this.originalPosition) return;
    
    // Calculate random target within bounds (small movement)
    const maxOffset = 24; // Reduced from 32 for smaller, more natural movements
    const targetX = this.originalPosition.x + (Math.random() - 0.5) * maxOffset * 2;
    const targetY = this.originalPosition.y + (Math.random() - 0.5) * maxOffset * 2;
    
    // Clamp to bounds with padding to prevent edge clipping
    const padding = 8;
    const clampedX = Math.max(
      this.wanderBounds.x + padding,
      Math.min(this.wanderBounds.x + this.wanderBounds.width - padding, targetX)
    );
    const clampedY = Math.max(
      this.wanderBounds.y + padding,
      Math.min(this.wanderBounds.y + this.wanderBounds.height - padding, targetY)
    );
    
    // Determine direction and walk
    const dx = clampedX - this.x;
    const dy = clampedY - this.y;
    
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      // Walk towards target
      if (Math.abs(dx) > Math.abs(dy)) {
        this.walk(dx > 0 ? 'right' : 'left');
      } else {
        this.walk(dy > 0 ? 'down' : 'up');
      }
      
      // Use slower tween for natural wandering (500ms per tile equivalent)
      const distance = Math.sqrt(dx * dx + dy * dy);
      const duration = Math.max(600, distance * 20); // Slower, more natural pace
      
      // Kill any existing wander tweens on this sprite before starting new one
      this.scene.tweens.killTweensOf(this);
      
      // Tween to target position
      this.scene.tweens.add({
        targets: this,
        x: clampedX,
        y: clampedY,
        duration,
        ease: 'Linear',
        onUpdate: () => {
          this.updateDepth();
        },
        onComplete: () => {
          if (this.isWandering) {
            this.idle();
            this.scheduleNextWander();
          }
        },
      });
    } else {
      // Just change facing direction randomly
      const directions: Direction[] = ['up', 'down', 'left', 'right'];
      this.setDirection(directions[Math.floor(Math.random() * 4)]);
      this.idle();
      this.scheduleNextWander();
    }
  }

  // Activity state management for detail panel
  setActivity(activity: string): void {
    this.currentActivity = activity;
  }

  setMood(mood: string): void {
    this.currentMood = mood;
  }

  setLocation(location: string): void {
    this.currentLocation = location;
  }

  getActivity(): string {
    return this.currentActivity;
  }

  getMood(): string {
    return this.currentMood;
  }

  getLocation(): string {
    return this.currentLocation;
  }

  // Work status management with emoji icons
  setWorkStatus(status: AgentWorkStatus): void {
    this.workStatus = status;
    this.updateStatusIcon();
  }

  getWorkStatus(): AgentWorkStatus {
    return this.workStatus;
  }

  private updateStatusIcon(): void {
    if (!this.statusIcon) return;
    
    const iconMap: Record<AgentWorkStatus, string> = {
      working: '💻',
      thinking: '💭',
      idle: '☕',
      error: '🔥',
    };
    
    this.statusIcon.setText(iconMap[this.workStatus] || '☕');
    
    // Add subtle animation for working/thinking states
    if (this.workStatus === 'working' || this.workStatus === 'thinking') {
      this.scene.tweens.add({
        targets: this.statusIcon,
        y: this.statusIcon.y - 2,
        duration: 500,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    } else {
      this.scene.tweens.killTweensOf(this.statusIcon);
      this.statusIcon.setY(-SPRITE_CONFIG.frameHeight * 1.5 - 26);
    }
  }

  // Clean up on destroy
  destroy(fromScene?: boolean): void {
    this.stopWandering();
    super.destroy(fromScene);
  }
}
