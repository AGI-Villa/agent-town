import Phaser from 'phaser';
import { PICO8_COLORS } from '../tiles/palette';

export type WeatherType = 'sunny' | 'rain' | 'snow';
export type HolidayType = 'none' | 'chinese_new_year' | 'christmas';

export interface EnvironmentConfig {
  weather: WeatherType;
  holiday: HolidayType;
  particleCount: number;
}

const DEFAULT_CONFIG: EnvironmentConfig = {
  weather: 'sunny',
  holiday: 'none',
  particleCount: 100,
};

interface Particle {
  x: number;
  y: number;
  speed: number;
  size: number;
  graphics: Phaser.GameObjects.Graphics;
}

interface Decoration {
  x: number;
  y: number;
  type: string;
  container: Phaser.GameObjects.Container;
}

export class EnvironmentSystem {
  private scene: Phaser.Scene;
  private config: EnvironmentConfig;
  private mapWidth: number;
  private mapHeight: number;
  private particles: Particle[] = [];
  private decorations: Decoration[] = [];
  private weatherOverlay?: Phaser.GameObjects.Graphics;

  constructor(
    scene: Phaser.Scene,
    mapWidth: number,
    mapHeight: number,
    config: Partial<EnvironmentConfig> = {}
  ) {
    this.scene = scene;
    this.mapWidth = mapWidth;
    this.mapHeight = mapHeight;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  create(): void {
    // Create weather overlay for darkening effect
    this.weatherOverlay = this.scene.add.graphics();
    this.weatherOverlay.setDepth(90);
    this.weatherOverlay.setScrollFactor(0);

    this.applyWeather(this.config.weather);
    this.applyHoliday(this.config.holiday);
  }

  setWeather(weather: WeatherType): void {
    this.clearParticles();
    this.config.weather = weather;
    this.applyWeather(weather);
  }

  setHoliday(holiday: HolidayType): void {
    this.clearDecorations();
    this.config.holiday = holiday;
    this.applyHoliday(holiday);
  }

  private applyWeather(weather: WeatherType): void {
    if (!this.weatherOverlay) return;
    this.weatherOverlay.clear();

    switch (weather) {
      case 'rain':
        // Darken the scene slightly
        this.weatherOverlay.fillStyle(0x1d2b53, 0.2);
        this.weatherOverlay.fillRect(0, 0, this.scene.cameras.main.width, this.scene.cameras.main.height);
        this.createRainParticles();
        break;
      case 'snow':
        // Slight white overlay
        this.weatherOverlay.fillStyle(0xffffff, 0.1);
        this.weatherOverlay.fillRect(0, 0, this.scene.cameras.main.width, this.scene.cameras.main.height);
        this.createSnowParticles();
        break;
      case 'sunny':
      default:
        // No overlay for sunny weather
        break;
    }
  }

  private createRainParticles(): void {
    for (let i = 0; i < this.config.particleCount; i++) {
      const graphics = this.scene.add.graphics();
      graphics.setDepth(95);
      
      const particle: Particle = {
        x: Math.random() * this.mapWidth,
        y: Math.random() * this.mapHeight,
        speed: 8 + Math.random() * 4,
        size: 2 + Math.random() * 2,
        graphics,
      };
      
      this.drawRainDrop(particle);
      this.particles.push(particle);
    }
  }

  private drawRainDrop(particle: Particle): void {
    particle.graphics.clear();
    particle.graphics.lineStyle(1, PICO8_COLORS.blue, 0.6);
    particle.graphics.lineBetween(
      particle.x,
      particle.y,
      particle.x - 2,
      particle.y + particle.size * 3
    );
  }

  private createSnowParticles(): void {
    for (let i = 0; i < this.config.particleCount; i++) {
      const graphics = this.scene.add.graphics();
      graphics.setDepth(95);
      
      const particle: Particle = {
        x: Math.random() * this.mapWidth,
        y: Math.random() * this.mapHeight,
        speed: 1 + Math.random() * 2,
        size: 2 + Math.random() * 3,
        graphics,
      };
      
      this.drawSnowflake(particle);
      this.particles.push(particle);
    }
  }

  private drawSnowflake(particle: Particle): void {
    particle.graphics.clear();
    particle.graphics.fillStyle(PICO8_COLORS.white, 0.8);
    particle.graphics.fillCircle(particle.x, particle.y, particle.size);
  }

  private applyHoliday(holiday: HolidayType): void {
    switch (holiday) {
      case 'chinese_new_year':
        this.createChineseNewYearDecorations();
        break;
      case 'christmas':
        this.createChristmasDecorations();
        break;
      case 'none':
      default:
        break;
    }
  }

  private createChineseNewYearDecorations(): void {
    // Place lanterns at key locations
    const lanternPositions = [
      { x: 100, y: 50 },
      { x: 200, y: 50 },
      { x: 300, y: 50 },
      { x: 400, y: 50 },
      { x: 500, y: 50 },
    ];

    for (const pos of lanternPositions) {
      const container = this.scene.add.container(pos.x, pos.y);
      container.setDepth(85);

      const graphics = this.scene.add.graphics();
      
      // Lantern string
      graphics.lineStyle(1, PICO8_COLORS.brown);
      graphics.lineBetween(0, -20, 0, 0);
      
      // Lantern body (red)
      graphics.fillStyle(PICO8_COLORS.red);
      graphics.fillEllipse(0, 12, 16, 24);
      
      // Lantern top/bottom caps
      graphics.fillStyle(PICO8_COLORS.yellow);
      graphics.fillRect(-6, 0, 12, 4);
      graphics.fillRect(-6, 22, 12, 4);
      
      // Lantern tassels
      graphics.lineStyle(1, PICO8_COLORS.yellow);
      graphics.lineBetween(-2, 26, -2, 34);
      graphics.lineBetween(2, 26, 2, 34);
      
      container.add(graphics);
      
      // Add gentle swaying animation
      this.scene.tweens.add({
        targets: container,
        angle: { from: -5, to: 5 },
        duration: 2000 + Math.random() * 1000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });

      this.decorations.push({
        x: pos.x,
        y: pos.y,
        type: 'lantern',
        container,
      });
    }
  }

  private createChristmasDecorations(): void {
    // Place Christmas trees at key locations
    const treePositions = [
      { x: 150, y: 100 },
      { x: 350, y: 100 },
    ];

    for (const pos of treePositions) {
      const container = this.scene.add.container(pos.x, pos.y);
      container.setDepth(85);

      const graphics = this.scene.add.graphics();
      
      // Tree trunk
      graphics.fillStyle(PICO8_COLORS.brown);
      graphics.fillRect(-4, 20, 8, 12);
      
      // Tree layers (green triangles)
      graphics.fillStyle(PICO8_COLORS.darkGreen);
      graphics.fillTriangle(0, -30, -20, 0, 20, 0);
      graphics.fillTriangle(0, -15, -16, 10, 16, 10);
      graphics.fillTriangle(0, 0, -12, 20, 12, 20);
      
      // Star on top
      graphics.fillStyle(PICO8_COLORS.yellow);
      this.drawStar(graphics, 0, -35, 6);
      
      // Ornaments
      graphics.fillStyle(PICO8_COLORS.red);
      graphics.fillCircle(-8, -5, 3);
      graphics.fillCircle(6, 5, 3);
      graphics.fillStyle(PICO8_COLORS.blue);
      graphics.fillCircle(4, -10, 3);
      graphics.fillCircle(-5, 10, 3);
      
      container.add(graphics);

      // Add twinkling lights effect
      const lights = this.scene.add.graphics();
      container.add(lights);
      
      this.scene.time.addEvent({
        delay: 500,
        loop: true,
        callback: () => {
          lights.clear();
          lights.fillStyle(PICO8_COLORS.yellow, Math.random() > 0.5 ? 1 : 0.3);
          lights.fillCircle(-10, -2, 2);
          lights.fillStyle(PICO8_COLORS.yellow, Math.random() > 0.5 ? 1 : 0.3);
          lights.fillCircle(8, -8, 2);
          lights.fillStyle(PICO8_COLORS.yellow, Math.random() > 0.5 ? 1 : 0.3);
          lights.fillCircle(-6, 8, 2);
          lights.fillStyle(PICO8_COLORS.yellow, Math.random() > 0.5 ? 1 : 0.3);
          lights.fillCircle(10, 12, 2);
        },
      });

      this.decorations.push({
        x: pos.x,
        y: pos.y,
        type: 'christmas_tree',
        container,
      });
    }
  }

  private drawStar(graphics: Phaser.GameObjects.Graphics, x: number, y: number, size: number): void {
    const points: number[] = [];
    for (let i = 0; i < 10; i++) {
      const angle = (i * Math.PI) / 5 - Math.PI / 2;
      const radius = i % 2 === 0 ? size : size / 2;
      points.push(x + Math.cos(angle) * radius);
      points.push(y + Math.sin(angle) * radius);
    }
    graphics.fillPoints(points, true);
  }

  private clearParticles(): void {
    for (const particle of this.particles) {
      particle.graphics.destroy();
    }
    this.particles = [];
  }

  private clearDecorations(): void {
    for (const decoration of this.decorations) {
      decoration.container.destroy();
    }
    this.decorations = [];
  }

  update(): void {
    this.updateParticles();
  }

  private updateParticles(): void {
    const cam = this.scene.cameras.main;
    
    for (const particle of this.particles) {
      if (this.config.weather === 'rain') {
        particle.y += particle.speed;
        particle.x -= particle.speed * 0.2;
        
        if (particle.y > cam.scrollY + cam.height) {
          particle.y = cam.scrollY - 10;
          particle.x = cam.scrollX + Math.random() * cam.width;
        }
        if (particle.x < cam.scrollX - 10) {
          particle.x = cam.scrollX + cam.width;
        }
        
        this.drawRainDrop(particle);
      } else if (this.config.weather === 'snow') {
        particle.y += particle.speed;
        particle.x += Math.sin(particle.y * 0.02) * 0.5;
        
        if (particle.y > cam.scrollY + cam.height) {
          particle.y = cam.scrollY - 10;
          particle.x = cam.scrollX + Math.random() * cam.width;
        }
        
        this.drawSnowflake(particle);
      }
    }
  }

  getWeather(): WeatherType {
    return this.config.weather;
  }

  getHoliday(): HolidayType {
    return this.config.holiday;
  }

  destroy(): void {
    this.clearParticles();
    this.clearDecorations();
    if (this.weatherOverlay) {
      this.weatherOverlay.destroy();
    }
  }
}
