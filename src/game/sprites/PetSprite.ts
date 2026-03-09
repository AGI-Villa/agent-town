import Phaser from 'phaser';
import { TILE_SIZE } from '../tiles/tileset-generator';

type PetType = 'cat' | 'dog';

const PET_COLORS: Record<PetType, { body: number; accent: number; eye: number }> = {
  cat: { body: 0xffaa66, accent: 0xff8844, eye: 0x44cc44 },
  dog: { body: 0xcc9966, accent: 0xaa7744, eye: 0x442200 },
};

const CAT_VARIANTS = [
  { body: 0xffaa66, accent: 0xff8844, eye: 0x44cc44 },
  { body: 0x888888, accent: 0x666666, eye: 0xffcc00 },
  { body: 0xffffff, accent: 0xeeeecc, eye: 0x4488ff },
  { body: 0x222222, accent: 0x444444, eye: 0xffee00 },
];

const DOG_VARIANTS = [
  { body: 0xcc9966, accent: 0xaa7744, eye: 0x442200 },
  { body: 0xeeeeee, accent: 0xcccccc, eye: 0x332200 },
  { body: 0x886644, accent: 0x664422, eye: 0x221100 },
];

export class PetSprite extends Phaser.GameObjects.Container {
  private petType: PetType;
  private petGfx: Phaser.GameObjects.Graphics;
  private petLabel: Phaser.GameObjects.Text;
  private targetX: number;
  private targetY: number;
  private wanderTimer: number = 0;
  private wanderDelay: number;
  private mapWidth: number;
  private mapHeight: number;
  private speed: number = 0.3;
  private petName: string;
  private isInteracting: boolean = false;
  private interactBubble: Phaser.GameObjects.Container | null = null;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    type: PetType,
    name: string,
    variantIndex: number,
    mapW: number,
    mapH: number
  ) {
    super(scene, x, y);
    this.petType = type;
    this.petName = name;
    this.targetX = x;
    this.targetY = y;
    this.mapWidth = mapW;
    this.mapHeight = mapH;
    this.wanderDelay = 3000 + Math.random() * 5000;

    const variants = type === 'cat' ? CAT_VARIANTS : DOG_VARIANTS;
    const colors = variants[variantIndex % variants.length];

    this.petGfx = scene.add.graphics();
    this.drawPet(colors, type);
    this.add(this.petGfx);

    this.petLabel = scene.add.text(0, -14, name, {
      fontSize: '5px',
      fontFamily: '"Press Start 2P", monospace',
      color: type === 'cat' ? '#ffcc88' : '#ccaa88',
      stroke: '#000000',
      strokeThickness: 1,
    });
    this.petLabel.setOrigin(0.5, 1);
    this.add(this.petLabel);

    this.setDepth(y);
    this.setScale(0.9);
    scene.add.existing(this);
  }

  private drawPet(c: { body: number; accent: number; eye: number }, type: PetType): void {
    const g = this.petGfx;
    if (type === 'cat') {
      // Body
      g.fillStyle(c.body); g.fillRect(-5, -4, 10, 8);
      // Head
      g.fillStyle(c.body); g.fillRect(-4, -10, 8, 7);
      // Ears (triangular)
      g.fillStyle(c.accent);
      g.fillRect(-4, -12, 3, 3);
      g.fillRect(1, -12, 3, 3);
      // Eyes
      g.fillStyle(c.eye);
      g.fillRect(-3, -8, 2, 2);
      g.fillRect(1, -8, 2, 2);
      // Nose
      g.fillStyle(0xff8888);
      g.fillRect(-1, -6, 2, 1);
      // Tail
      g.fillStyle(c.accent);
      g.fillRect(5, -6, 2, 2);
      g.fillRect(6, -8, 2, 2);
      g.fillRect(7, -10, 2, 2);
    } else {
      // Body
      g.fillStyle(c.body); g.fillRect(-6, -4, 12, 8);
      // Head
      g.fillStyle(c.body); g.fillRect(-5, -11, 10, 8);
      // Ears (floppy)
      g.fillStyle(c.accent);
      g.fillRect(-6, -11, 3, 5);
      g.fillRect(3, -11, 3, 5);
      // Eyes
      g.fillStyle(c.eye);
      g.fillRect(-3, -8, 2, 2);
      g.fillRect(1, -8, 2, 2);
      // Nose
      g.fillStyle(0x332222);
      g.fillRect(-1, -5, 2, 2);
      // Tongue (happy dog)
      g.fillStyle(0xff6666);
      g.fillRect(0, -3, 2, 2);
      // Tail
      g.fillStyle(c.accent);
      g.fillRect(6, -6, 2, 4);
      g.fillRect(7, -8, 2, 2);
    }
    // Feet
    g.fillStyle(type === 'cat' ? c.accent : c.body);
    g.fillRect(-4, 3, 2, 2);
    g.fillRect(2, 3, 2, 2);
  }

  showInteraction(emoji: string): void {
    if (this.interactBubble) return;
    this.isInteracting = true;
    this.interactBubble = this.scene.add.container(0, -20);
    const bg = this.scene.add.graphics();
    bg.fillStyle(0xffffff, 0.9);
    bg.fillRoundedRect(-10, -10, 20, 16, 4);
    this.interactBubble.add(bg);
    const txt = this.scene.add.text(0, -3, emoji, { fontSize: '10px' });
    txt.setOrigin(0.5, 0.5);
    this.interactBubble.add(txt);
    this.add(this.interactBubble);

    this.scene.time.delayedCall(3000, () => {
      this.interactBubble?.destroy();
      this.interactBubble = null;
      this.isInteracting = false;
    });
  }

  update(_time: number, delta: number): void {
    if (this.isInteracting) return;

    this.wanderTimer += delta;
    if (this.wanderTimer >= this.wanderDelay) {
      this.wanderTimer = 0;
      this.wanderDelay = 2000 + Math.random() * 6000;
      const range = TILE_SIZE * 4;
      this.targetX = Phaser.Math.Clamp(
        this.x + (Math.random() - 0.5) * range * 2,
        TILE_SIZE * 2, this.mapWidth - TILE_SIZE * 2
      );
      this.targetY = Phaser.Math.Clamp(
        this.y + (Math.random() - 0.5) * range * 2,
        TILE_SIZE * 2, this.mapHeight - TILE_SIZE * 2
      );
    }

    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 2) {
      this.x += (dx / dist) * this.speed * delta * 0.06;
      this.y += (dy / dist) * this.speed * delta * 0.06;
      this.setDepth(this.y);
      // Flip based on direction
      this.petGfx.setScale(dx < 0 ? -1 : 1, 1);
    }
  }

  getPetName(): string { return this.petName; }
  getPetType(): PetType { return this.petType; }
  getIsInteracting(): boolean { return this.isInteracting; }
}
