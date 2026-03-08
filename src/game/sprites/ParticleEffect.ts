import Phaser from 'phaser';
import { PICO8_COLORS } from '../tiles/palette';

export type ParticleType = 'heart' | 'star' | 'sparkle';

export class ParticleEffect {
  private scene: Phaser.Scene;
  private particles: Phaser.GameObjects.Graphics[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  emitParticles(x: number, y: number, type: ParticleType, count: number = 5): void {
    for (let i = 0; i < count; i++) {
      const particle = this.createParticle(type);
      particle.setPosition(x, y);
      particle.setDepth(2001);
      this.particles.push(particle);

      // Animate particle
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const distance = 20 + Math.random() * 30;
      const targetX = x + Math.cos(angle) * distance;
      const targetY = y + Math.sin(angle) * distance - 20;

      this.scene.tweens.add({
        targets: particle,
        x: targetX,
        y: targetY,
        alpha: 0,
        scale: 0.5,
        duration: 800 + Math.random() * 400,
        ease: 'Quad.easeOut',
        onComplete: () => {
          particle.destroy();
          const idx = this.particles.indexOf(particle);
          if (idx > -1) this.particles.splice(idx, 1);
        },
      });
    }
  }

  private createParticle(type: ParticleType): Phaser.GameObjects.Graphics {
    const g = this.scene.add.graphics();

    switch (type) {
      case 'heart':
        this.drawHeart(g);
        break;
      case 'star':
        this.drawStar(g);
        break;
      case 'sparkle':
        this.drawSparkle(g);
        break;
    }

    return g;
  }

  private drawHeart(g: Phaser.GameObjects.Graphics): void {
    g.fillStyle(PICO8_COLORS.red);
    // Simple pixel heart
    g.fillRect(-3, -2, 2, 2);
    g.fillRect(1, -2, 2, 2);
    g.fillRect(-4, -1, 2, 2);
    g.fillRect(2, -1, 2, 2);
    g.fillRect(-4, 0, 8, 2);
    g.fillRect(-3, 2, 6, 2);
    g.fillRect(-2, 4, 4, 1);
    g.fillRect(-1, 5, 2, 1);
  }

  private drawStar(g: Phaser.GameObjects.Graphics): void {
    g.fillStyle(PICO8_COLORS.yellow);
    // Simple pixel star
    g.fillRect(-1, -4, 2, 2);
    g.fillRect(-3, -2, 6, 2);
    g.fillRect(-4, 0, 8, 2);
    g.fillRect(-3, 2, 6, 2);
    g.fillRect(-1, 4, 2, 2);
  }

  private drawSparkle(g: Phaser.GameObjects.Graphics): void {
    g.fillStyle(PICO8_COLORS.white);
    // Simple sparkle
    g.fillRect(0, -3, 1, 7);
    g.fillRect(-3, 0, 7, 1);
    g.fillStyle(PICO8_COLORS.yellow);
    g.fillRect(-1, -1, 3, 3);
  }

  destroy(): void {
    this.particles.forEach(p => p.destroy());
    this.particles = [];
  }
}
