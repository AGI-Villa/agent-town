import Phaser from 'phaser';
import { TILE_SIZE } from '../tiles/tileset-generator';

const T = TILE_SIZE;

function hash(x: number, y: number): number {
  let h = x * 374761393 + y * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  return (h ^ (h >> 16)) >>> 0;
}

export interface MapData {
  width: number;
  height: number;
  layers: { ground: number[][]; furniture: number[][] };
  areas?: Record<string, { x: number; y: number; width: number; height: number; name: string }>;
}

export class TownRenderer {
  private scene: Phaser.Scene;
  private map: MapData;
  private groundGraphics: Phaser.GameObjects.Graphics | null = null;
  private furnitureGraphics: Phaser.GameObjects.Graphics | null = null;
  private lastVisibleBounds: { x1: number; y1: number; x2: number; y2: number } | null = null;
  private cullingEnabled = true;
  
  constructor(scene: Phaser.Scene, map: MapData) { this.scene = scene; this.map = map; }

  renderAll(): void {
    this.renderGround();
    this.renderFurniture();
    this.renderAreaLabels();
  }

  // Enable/disable camera culling
  setCullingEnabled(enabled: boolean): void {
    this.cullingEnabled = enabled;
  }

  // Get visible tile bounds from camera
  private getVisibleTileBounds(): { x1: number; y1: number; x2: number; y2: number } {
    const cam = this.scene.cameras.main;
    const padding = 2; // Extra tiles for smooth scrolling
    
    const x1 = Math.max(0, Math.floor(cam.scrollX / T) - padding);
    const y1 = Math.max(0, Math.floor(cam.scrollY / T) - padding);
    const x2 = Math.min(this.map.width, Math.ceil((cam.scrollX + cam.width / cam.zoom) / T) + padding);
    const y2 = Math.min(this.map.height, Math.ceil((cam.scrollY + cam.height / cam.zoom) / T) + padding);
    
    return { x1, y1, x2, y2 };
  }

  // Check if bounds have changed significantly
  private boundsChanged(newBounds: { x1: number; y1: number; x2: number; y2: number }): boolean {
    if (!this.lastVisibleBounds) return true;
    const { x1, y1, x2, y2 } = this.lastVisibleBounds;
    return newBounds.x1 !== x1 || newBounds.y1 !== y1 || newBounds.x2 !== x2 || newBounds.y2 !== y2;
  }

  // ═══════════════════════════════════════════════════════════
  //  GROUND RENDERING
  // ═══════════════════════════════════════════════════════════

  private renderGround(): void {
    const gfx = this.scene.add.graphics().setDepth(0);
    const { ground } = this.map.layers;
    for (let y = 0; y < this.map.height; y++)
      for (let x = 0; x < this.map.width; x++)
        this.drawGround(gfx, x * T, y * T, x, y, ground[y][x]);
  }

  private drawGround(g: Phaser.GameObjects.Graphics, px: number, py: number, tx: number, ty: number, tile: number): void {
    const h = hash(tx, ty);
    switch (tile) {
      case 0: // Office floor A
        g.fillStyle(0x8898b0); g.fillRect(px, py, T, T);
        g.fillStyle(0x7e8eaa, 0.4); g.fillRect(px + 1, py + 1, T - 2, T - 2);
        break;
      case 1: // Office floor B
        g.fillStyle(0x828caa); g.fillRect(px, py, T, T);
        g.fillStyle(0x8898b0, 0.3); g.fillRect(px + 1, py + 1, T - 2, T - 2);
        break;
      case 2: // Carpet
        g.fillStyle(0x556688); g.fillRect(px, py, T, T);
        g.fillStyle(0x4a5b7a, 0.35);
        g.fillRect(px + 4, py + 6, 8, 1); g.fillRect(px + 16, py + 20, 10, 1);
        break;

      case 3: { // Grass — natural yellow-green with multi-layer variation
        // Base color: lower saturation, more natural yellow-green
        g.fillStyle(0x7ab87a); g.fillRect(px, py, T, T);
        // Layer 1: Large subtle patch
        g.fillStyle(0x72b072, 0.15);
        g.fillRect(px + (h % 10), py + ((h >> 3) % 10), 20 + (h % 8), 18 + ((h >> 6) % 8));
        // Layer 2: Medium patch
        g.fillStyle(0x82c082, 0.12);
        g.fillRect(px + ((h >> 4) % 12) + 4, py + ((h >> 7) % 12) + 4, 14 + (h % 4), 12 + ((h >> 10) % 4));
        // Layer 3: Small highlight patch
        g.fillStyle(0x8ac88a, 0.08);
        g.fillRect(px + ((h >> 2) % 16) + 6, py + ((h >> 5) % 14) + 8, 8, 6);
        // Grass blades
        g.fillStyle(0x88d088, 0.2);
        g.fillRect(px + (h % 24) + 3, py + ((h >> 3) % 20) + 5, 1, 3);
        if (h % 4 === 0) {
          g.fillRect(px + ((h >> 6) % 20) + 8, py + ((h >> 9) % 16) + 10, 1, 4);
        }
        // Small details: fallen leaves, pebbles, mushrooms (~3% each)
        if (h % 35 === 0) { // Fallen leaf (autumn color)
          g.fillStyle(0xc89858, 0.35);
          g.fillRect(px + (h % 20) + 6, py + ((h >> 4) % 18) + 8, 4, 3);
          g.fillStyle(0xb88848, 0.25);
          g.fillRect(px + (h % 20) + 7, py + ((h >> 4) % 18) + 9, 2, 1);
        }
        if (h % 40 === 1) { // Small pebble
          g.fillStyle(0x9a9890, 0.3);
          g.fillCircle(px + ((h >> 2) % 22) + 5, py + ((h >> 5) % 20) + 6, 2);
        }
        if (h % 50 === 2) { // Tiny mushroom
          g.fillStyle(0xddccbb, 0.4);
          g.fillRect(px + ((h >> 3) % 20) + 8, py + ((h >> 6) % 16) + 12, 2, 3);
          g.fillStyle(0xcc6644, 0.5);
          g.fillCircle(px + ((h >> 3) % 20) + 9, py + ((h >> 6) % 16) + 11, 2.5);
        }
        break;
      }

      case 4: { // Cobblestone road — with curb stones and details
        g.fillStyle(0x8a8890); g.fillRect(px, py, T, T);
        const sc = [0x969494, 0x8a8888, 0x7e7c7c, 0x908e8e];
        g.fillStyle(sc[h % 4], 0.65);
        g.fillRect(px + 3, py + 3, 12, 12);
        g.fillStyle(sc[(h >> 4) % 4], 0.65);
        g.fillRect(px + 17, py + 3, 12, 12);
        g.fillStyle(sc[(h >> 8) % 4], 0.65);
        g.fillRect(px + 3, py + 17, 12, 12);
        g.fillStyle(sc[(h >> 12) % 4], 0.65);
        g.fillRect(px + 17, py + 17, 12, 12);
        // Grout lines
        g.fillStyle(0x6a6868, 0.35);
        g.fillRect(px + 15, py + 2, 2, T - 4); g.fillRect(px + 2, py + 15, T - 4, 2);
        // Curb stones on edges (lighter color)
        g.fillStyle(0xb8b4a8, 0.6);
        g.fillRect(px, py, 2, T); g.fillRect(px + T - 2, py, 2, T);
        // Small cracks and grass growing through (~5%)
        if (h % 20 === 0) {
          g.fillStyle(0x5a5858, 0.4);
          g.fillRect(px + (h % 18) + 6, py + ((h >> 3) % 14) + 8, 6, 1);
          g.fillRect(px + (h % 18) + 8, py + ((h >> 3) % 14) + 6, 1, 4);
        }
        if (h % 22 === 1) { // Grass through crack
          g.fillStyle(0x6ab86a, 0.35);
          g.fillRect(px + ((h >> 2) % 20) + 6, py + ((h >> 5) % 18) + 8, 1, 3);
        }
        break;
      }

      case 5: { // Wood floor (cafe) — enhanced with wood grain and knots
        g.fillStyle(0xb8885a); g.fillRect(px, py, T, T);
        g.fillStyle(0xc89868, 0.45);
        g.fillRect(px + (tx % 2) * 16, py, 16, T);
        // Wood grain lines
        g.fillStyle(0xa07848, 0.3);
        g.fillRect(px, py + 7, T, 1); g.fillRect(px, py + 15, T, 1); g.fillRect(px, py + 23, T, 1);
        // Additional grain detail
        g.fillStyle(0x9a6838, 0.2);
        g.fillRect(px + 2, py + 3, 12, 1); g.fillRect(px + 18, py + 11, 10, 1); g.fillRect(px + 6, py + 19, 14, 1);
        // Wood knots (pseudo-random based on position)
        if (h % 7 === 0) {
          g.fillStyle(0x8a5828, 0.35);
          g.fillCircle(px + (h % 20) + 6, py + ((h >> 4) % 16) + 8, 2);
        }
        if (h % 11 === 0) {
          g.fillStyle(0x7a4818, 0.25);
          g.fillCircle(px + ((h >> 3) % 18) + 8, py + ((h >> 6) % 14) + 10, 1.5);
        }
        // Subtle shadow/highlight variation
        g.fillStyle(0x000000, 0.03);
        g.fillRect(px + (h % 12), py + ((h >> 2) % 10), 14, 12);
        break;
      }

      case 6: { // Tile floor (store) — enhanced with gloss reflection
        g.fillStyle(0xe0dcd0); g.fillRect(px, py, T, T);
        g.fillStyle(0xd0ccc0, 0.45);
        g.fillRect(px + 1, py + 1, 14, 14); g.fillRect(px + 17, py + 17, 14, 14);
        g.fillStyle(0xc8c4b8, 0.25);
        g.fillRect(px + 15, py, 2, T); g.fillRect(px, py + 15, T, 2);
        // Subtle gloss reflection effect
        g.fillStyle(0xffffff, 0.08);
        g.fillRect(px + 2, py + 2, 10, 6);
        g.fillRect(px + 18, py + 18, 10, 6);
        // Micro highlight variation
        g.fillStyle(0xffffff, 0.04);
        g.fillRect(px + ((h % 8) + 4), py + ((h >> 3) % 6) + 2, 6, 3);
        // Subtle shadow for depth
        g.fillStyle(0x000000, 0.02);
        g.fillRect(px + 8, py + 10, 6, 4);
        g.fillRect(px + 22, py + 24, 8, 4);
        break;
      }

      case 7: { // Water
        const wc = [0x3a8abb, 0x3590c0, 0x3085b5];
        g.fillStyle(wc[h % 3]); g.fillRect(px, py, T, T);
        g.fillStyle(0x50a8d8, 0.35);
        g.fillRect(px + (h % 16) + 4, py + ((h >> 3) % 12) + 6, 10, 2);
        g.fillStyle(0x60b8e8, 0.25);
        g.fillRect(px + ((h >> 6) % 14) + 8, py + ((h >> 9) % 16) + 10, 8, 1);
        g.fillStyle(0x88ddff, 0.3);
        g.fillRect(px + ((h >> 12) % 18) + 6, py + ((h >> 4) % 10) + 4, 3, 1);
        break;
      }

      case 8: { // Forest floor
        g.fillStyle(0x4a8a48); g.fillRect(px, py, T, T);
        g.fillStyle(0x5a9a58, 0.25);
        g.fillRect(px + (h % 14) + 4, py + ((h >> 4) % 14) + 4, 12, 10);
        g.fillStyle(0x3a7a38, 0.2);
        g.fillRect(px + ((h >> 8) % 10) + 10, py + ((h >> 12) % 10) + 10, 8, 6);
        // Fallen leaf
        if (h % 8 === 0) {
          g.fillStyle(0x8a7a48, 0.25);
          g.fillRect(px + (h % 18) + 6, py + ((h >> 5) % 16) + 8, 3, 2);
        }
        break;
      }

      case 9: { // Stone path (pond rim / decorative)
        g.fillStyle(0xa8a498); g.fillRect(px, py, T, T);
        g.fillStyle(0xb8b4a8, 0.55);
        g.fillRect(px + 2, py + 2, 12, 12); g.fillRect(px + 16, py + 16, 12, 12);
        g.fillStyle(0x989488, 0.35);
        g.fillRect(px + 14, py + 4, 10, 10); g.fillRect(px + 4, py + 18, 10, 8);
        g.fillStyle(0x6aba6e, 0.2);
        g.fillRect(px + 14, py + 14, 2, 2);
        break;
      }

      case 10: { // Riverbank
        g.fillStyle(0x9aaa78); g.fillRect(px, py, T, T);
        g.fillStyle(0x8a9a68, 0.35);
        g.fillRect(px + (h % 8), py + ((h >> 3) % 8), 18, 16);
        g.fillStyle(0xb0a888, 0.3);
        g.fillRect(px + (h % 18) + 4, py + ((h >> 5) % 16) + 6, 6, 4);
        g.fillStyle(0x6aba6e, 0.2);
        g.fillRect(px + ((h >> 2) % 12) + 6, py + 2, 8, 3);
        break;
      }

      case 11: { // Dirt path — wider gradient transition to grass
        // Center: warm brown
        g.fillStyle(0xb8a078); g.fillRect(px, py, T, T);
        g.fillStyle(0xa89068, 0.35);
        g.fillRect(px + 4, py + 6, T - 8, T - 12);
        // Gradient transition zones (top and bottom)
        g.fillStyle(0x9a9068, 0.25);
        g.fillRect(px, py + 3, T, 4); g.fillRect(px, py + T - 7, T, 4);
        // Grass blending at edges (wider, 6px)
        g.fillStyle(0x7ab87a, 0.35);
        g.fillRect(px, py, T, 6); g.fillRect(px, py + T - 6, T, 6);
        g.fillStyle(0x8ac88a, 0.2);
        g.fillRect(px, py, T, 3); g.fillRect(px, py + T - 3, T, 3);
        // Scattered pebbles
        g.fillStyle(0x9a9488, 0.3);
        g.fillRect(px + (h % 18) + 6, py + ((h >> 3) % 12) + 10, 3, 2);
        if (h % 4 === 0) {
          g.fillRect(px + ((h >> 5) % 16) + 8, py + ((h >> 8) % 10) + 12, 2, 2);
        }
        // Occasional footprint impression
        if (h % 15 === 0) {
          g.fillStyle(0xa08058, 0.2);
          g.fillRect(px + (h % 14) + 8, py + 12, 4, 6);
        }
        break;
      }

      case 12: { // Plaza cobblestone (warm, decorative with pattern)
        g.fillStyle(0xc8b898); g.fillRect(px, py, T, T);
        // Alternating tile pattern
        g.fillStyle(0xd8c8a8, 0.5);
        g.fillRect(px + 1, py + 1, 14, 14); g.fillRect(px + 17, py + 17, 14, 14);
        g.fillStyle(0xb8a888, 0.5);
        g.fillRect(px + 17, py + 1, 14, 14); g.fillRect(px + 1, py + 17, 14, 14);
        // Grout lines
        g.fillStyle(0xa89878, 0.3);
        g.fillRect(px + 15, py, 2, T); g.fillRect(px, py + 15, T, 2);
        // Decorative center diamond pattern (for center tiles)
        if ((tx + ty) % 4 === 0) {
          g.fillStyle(0xe8d8b8, 0.4);
          // Diamond shape
          g.fillRect(px + 14, py + 10, 4, 4);
          g.fillRect(px + 12, py + 12, 8, 8);
          g.fillRect(px + 14, py + 18, 4, 4);
        }
        // Subtle wear marks
        g.fillStyle(0xb0a080, 0.15);
        g.fillRect(px + (h % 12) + 6, py + ((h >> 3) % 12) + 6, 8, 6);
        break;
      }
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  FURNITURE RENDERING
  // ═══════════════════════════════════════════════════════════

  private renderFurniture(): void {
    const gfx = this.scene.add.graphics().setDepth(1);
    const { furniture } = this.map.layers;
    for (let y = 0; y < this.map.height; y++)
      for (let x = 0; x < this.map.width; x++) {
        const tile = furniture[y][x];
        if (tile < 0) continue;
        this.drawFurniture(gfx, x * T, y * T, x, y, tile);
      }
  }

  private drawFurniture(g: Phaser.GameObjects.Graphics, px: number, py: number, tx: number, ty: number, tile: number): void {
    const h = hash(tx, ty);

    // ─── Villa multi-tile rendering ───
    if (tile >= 100 && tile <= 111) { this.drawVillaA(g, px, py, tile - 100, tx, ty); return; }
    if (tile >= 112 && tile <= 123) { this.drawVillaB(g, px, py, tile - 112, tx, ty); return; }
    if (tile >= 124 && tile <= 135) { this.drawVillaC(g, px, py, tile - 124, tx, ty); return; }

    switch (tile) {
      // ─── Walls (warm stone, enhanced with windows) ───
      case 10: { // top wall — thicker band with roof tiles and windows
        g.fillStyle(0xb8a888, 0.15); g.fillRect(px, py, T, T - 10);
        // Roof tile effect at top
        g.fillStyle(0xcc7755); g.fillRect(px, py, T, 3);
        g.fillStyle(0xbb6644); g.fillRect(px, py + 3, T, 2);
        // Wall body (10-12px)
        g.fillStyle(0x9a8a70); g.fillRect(px, py + T - 12, T, 12);
        g.fillStyle(0xb0a080); g.fillRect(px, py + T - 10, T, 2);
        g.fillStyle(0xc0b090, 0.5); g.fillRect(px, py + T - 2, T, 2);
        // Window detail on long walls (every other tile)
        if (tx % 3 === 1) {
          g.fillStyle(0x88aacc); g.fillRect(px + 10, py + T - 9, 12, 6);
          g.fillStyle(0x7a6a5a); g.fillRect(px + 10, py + T - 9, 12, 1);
          g.fillRect(px + 10, py + T - 4, 12, 1);
          g.fillRect(px + 10, py + T - 9, 1, 6);
          g.fillRect(px + 21, py + T - 9, 1, 6);
          g.fillStyle(0x000000, 0.1); g.fillRect(px + 16, py + T - 9, 1, 6);
        }
        break;
      }
      case 11: // bottom wall — thicker
        g.fillStyle(0x9a8a70); g.fillRect(px, py, T, 10);
        g.fillStyle(0xb0a080); g.fillRect(px, py + 6, T, 2);
        g.fillStyle(0xb8a888, 0.15); g.fillRect(px, py + 10, T, T - 10);
        break;
      case 12: // left wall — thicker (10px)
        g.fillStyle(0x9a8a70); g.fillRect(px + T - 10, py, 10, T);
        g.fillStyle(0xb0a080); g.fillRect(px + T - 8, py, 2, T);
        g.fillStyle(0xb8a888, 0.12); g.fillRect(px, py, T - 10, T);
        break;
      case 13: // right wall — thicker (10px)
        g.fillStyle(0x9a8a70); g.fillRect(px, py, 10, T);
        g.fillStyle(0xb0a080); g.fillRect(px + 6, py, 2, T);
        g.fillStyle(0xb8a888, 0.12); g.fillRect(px + 10, py, T - 10, T);
        break;

      // ─── Office furniture ───
      case 20: // desk
        g.fillStyle(0x9b8060); g.fillRect(px + 2, py + 12, T - 4, T - 14);
        g.fillStyle(0xbb9e7e); g.fillRect(px + 2, py + 8, T - 4, 6);
        g.fillStyle(0x6a5a40); g.fillRect(px + 4, py + T - 4, 3, 4); g.fillRect(px + T - 7, py + T - 4, 3, 4);
        break;
      case 24: // chair
        g.fillStyle(0x4477aa); g.fillRect(px + 8, py + 4, 16, 6);
        g.fillStyle(0x5588cc); g.fillRect(px + 6, py + 10, 20, 14);
        g.fillStyle(0x333333); g.fillRect(px + 8, py + 24, 2, 4); g.fillRect(px + 22, py + 24, 2, 4);
        break;
      case 28: // monitor
        g.fillStyle(0x444444); g.fillRect(px + 12, py + 18, 8, 4); g.fillRect(px + 14, py + 22, 4, 4);
        g.fillStyle(0x2a2a3e); g.fillRect(px + 4, py + 2, 24, 18);
        g.fillStyle(0x3366cc); g.fillRect(px + 6, py + 4, 20, 14);
        g.fillStyle(0x66aaff, 0.55); g.fillRect(px + 8, py + 7, 12, 1); g.fillRect(px + 8, py + 10, 16, 1); g.fillRect(px + 8, py + 13, 9, 1);
        g.fillStyle(0x00ff44); g.fillRect(px + 25, py + 17, 2, 2);
        break;
      case 40: // coffee machine
        g.fillStyle(0x5a5a66); g.fillRect(px + 4, py + 4, 24, 24);
        g.fillStyle(0x4a4a54); g.fillRect(px + 6, py + 4, 20, 8);
        g.fillStyle(0x2a2a34); g.fillRect(px + 10, py + 14, 12, 10);
        g.fillStyle(0xee3333); g.fillRect(px + 20, py + 24, 6, 4);
        g.fillStyle(0xf8f8f8); g.fillRect(px + 12, py + 20, 8, 6);
        break;
      case 41: // counter
        g.fillStyle(0xa87a50); g.fillRect(px, py + 8, T, T - 8);
        g.fillStyle(0xbb9a70); g.fillRect(px, py + 6, T, 4);
        break;
      case 44: // potted plant
        g.fillStyle(0x885533); g.fillRect(px + 10, py + 18, 12, 12);
        g.fillStyle(0x774422); g.fillRect(px + 8, py + 16, 16, 4);
        g.fillStyle(0x4a9b5a); g.fillCircle(px + 16, py + 12, 10);
        g.fillStyle(0x5aab6a); g.fillCircle(px + 14, py + 10, 6); g.fillCircle(px + 20, py + 11, 5);
        g.fillStyle(0x7acc8a, 0.35); g.fillCircle(px + 12, py + 8, 3);
        break;
      case 50: // meeting table
        g.fillStyle(0x9b8060); g.fillRect(px + 2, py + 6, T - 4, T - 6);
        g.fillStyle(0xbb9e7e); g.fillRect(px + 2, py + 4, T - 4, 4);
        break;
      case 54: // whiteboard
        g.fillStyle(0x555555); g.fillRect(px + 4, py + 2, 24, 28);
        g.fillStyle(0xf5f5f0); g.fillRect(px + 6, py + 4, 20, 22);
        g.fillStyle(0x3366cc, 0.6); g.fillRect(px + 8, py + 8, 14, 2); g.fillRect(px + 8, py + 13, 10, 2);
        g.fillStyle(0xcc3333, 0.5); g.fillRect(px + 8, py + 18, 16, 2);
        break;
      case 60: // door — with welcome mat/step
        // Welcome mat / step
        g.fillStyle(0x8a6a4a); g.fillRect(px + 4, py + T - 6, 24, 6);
        g.fillStyle(0x9a7a5a); g.fillRect(px + 6, py + T - 5, 20, 4);
        g.fillStyle(0x7a5a3a, 0.4); g.fillRect(px + 8, py + T - 4, 16, 2);
        // Door
        g.fillStyle(0x8b6246); g.fillRect(px + 6, py + 2, 20, T - 8);
        g.fillStyle(0x7a5236, 0.5); g.fillRect(px + 9, py + 5, 14, 10); g.fillRect(px + 9, py + 18, 14, 6);
        g.fillStyle(0xccaa44); g.fillRect(px + 21, py + 14, 3, 4);
        break;

      // ─── Park furniture ───
      case 70: // fence horizontal
        g.fillStyle(0x9a7850); g.fillRect(px, py + 12, T, 3); g.fillRect(px, py + 18, T, 3);
        g.fillStyle(0xbb9868); g.fillRect(px + 4, py + 8, 3, 16); g.fillRect(px + T - 7, py + 8, 3, 16);
        break;
      case 71: // fence vertical
        g.fillStyle(0x9a7850); g.fillRect(px + 12, py, 3, T); g.fillRect(px + 18, py, 3, T);
        g.fillStyle(0xbb9868); g.fillRect(px + 8, py + 4, 16, 3); g.fillRect(px + 8, py + T - 7, 16, 3);
        break;
      case 72: { // tree (varied canopy per instance)
        g.fillStyle(0x8b6246); g.fillRect(px + 12, py + 18, 8, 14);
        g.fillStyle(0x5a3220, 0.25); g.fillRect(px + 12, py + 18, 3, 14);
        const tc = h % 3;
        const lc = [[0x3a8b4a, 0x4a9b5a, 0x68bc68], [0x3a7b4a, 0x4a8b5a, 0x5aab60], [0x448e50, 0x54a060, 0x68c06e]];
        g.fillStyle(lc[tc][0]); g.fillCircle(px + 16, py + 14, 14);
        g.fillStyle(lc[tc][1]); g.fillCircle(px + 13, py + 12, 9); g.fillCircle(px + 20, py + 13, 7);
        g.fillStyle(lc[tc][2], 0.45); g.fillCircle(px + 11, py + 8, 4); g.fillCircle(px + 20, py + 10, 3);
        break;
      }
      case 73: // bench
        g.fillStyle(0xab8864); g.fillRect(px + 2, py + 14, 28, 6); g.fillRect(px + 2, py + 10, 28, 4);
        g.fillStyle(0x7a6050); g.fillRect(px + 4, py + 20, 4, 8); g.fillRect(px + 24, py + 20, 4, 8);
        break;
      case 74: // fountain
        g.fillStyle(0x8899aa); g.fillCircle(px + 16, py + 18, 14);
        g.fillStyle(0x66aaee); g.fillCircle(px + 16, py + 18, 11);
        g.fillStyle(0x88ccff, 0.45); g.fillCircle(px + 12, py + 16, 3); g.fillCircle(px + 20, py + 20, 2);
        g.fillStyle(0x8899aa); g.fillCircle(px + 16, py + 16, 4);
        g.fillStyle(0x88ccff, 0.65); g.fillRect(px + 15, py + 8, 2, 6);
        break;
      case 75: { // flower cluster
        const fc = h % 3;
        const fl = [[0xff88aa, 0xffcc66, 0xcc88ff], [0xff6688, 0xffaa44, 0xaa66dd], [0xee99bb, 0xeebb55, 0xbb77ee]];
        g.fillStyle(0x5a9964); g.fillRect(px + 8, py + 16, 2, 10); g.fillRect(px + 16, py + 14, 2, 12); g.fillRect(px + 24, py + 18, 2, 8);
        g.fillStyle(fl[fc][0]); g.fillCircle(px + 9, py + 14, 4);
        g.fillStyle(fl[fc][1]); g.fillCircle(px + 17, py + 12, 4);
        g.fillStyle(fl[fc][2]); g.fillCircle(px + 25, py + 16, 4);
        g.fillStyle(0xffee44); g.fillCircle(px + 9, py + 14, 1); g.fillCircle(px + 17, py + 12, 1); g.fillCircle(px + 25, py + 16, 1);
        break;
      }
      case 76: { // bush
        const bc = h % 2;
        g.fillStyle(bc === 0 ? 0x3a8a48 : 0x448e50); g.fillCircle(px + 16, py + 20, 11);
        g.fillStyle(bc === 0 ? 0x4a9a58 : 0x54a060); g.fillCircle(px + 12, py + 18, 7); g.fillCircle(px + 22, py + 19, 6);
        g.fillStyle(0x6aca6e, 0.25); g.fillCircle(px + 14, py + 16, 3);
        break;
      }
      case 77: { // rock cluster
        g.fillStyle(0x8a8878); g.fillCircle(px + 16, py + 20, 8);
        g.fillStyle(0x9a9888); g.fillCircle(px + 12, py + 18, 5);
        g.fillStyle(0x7a7868, 0.55); g.fillCircle(px + 22, py + 22, 5);
        g.fillStyle(0xaaa898, 0.25); g.fillRect(px + 10, py + 16, 6, 3);
        break;
      }
      case 78: { // wildflowers (small scattered)
        const wc = [0xff88aa, 0xffcc66, 0xcc88ff, 0xffaa88];
        g.fillStyle(0x5a9964, 0.5); g.fillRect(px + 6, py + 20, 1, 6); g.fillRect(px + 16, py + 18, 1, 8); g.fillRect(px + 26, py + 22, 1, 5);
        g.fillStyle(wc[h % 4]); g.fillCircle(px + 7, py + 19, 2);
        g.fillStyle(wc[(h + 1) % 4]); g.fillCircle(px + 17, py + 17, 2);
        g.fillStyle(wc[(h + 2) % 4]); g.fillCircle(px + 27, py + 21, 2);
        break;
      }
      case 79: // grass tuft
        g.fillStyle(0x5aa85e, 0.6);
        g.fillRect(px + 8, py + 14, 2, 12); g.fillRect(px + 12, py + 12, 2, 14);
        g.fillRect(px + 16, py + 16, 2, 10); g.fillRect(px + 20, py + 13, 2, 13);
        g.fillStyle(0x7acc7e, 0.35);
        g.fillRect(px + 11, py + 11, 3, 2); g.fillRect(px + 19, py + 12, 3, 2);
        break;

      // ─── Misc ───
      case 81: // lamp post
        g.fillStyle(0x6a6a6a); g.fillRect(px + 14, py + 10, 4, 22); g.fillRect(px + 12, py + 28, 8, 4);
        g.fillStyle(0x555555); g.fillRect(px + 10, py + 6, 12, 6);
        g.fillStyle(0xffeeaa, 0.3); g.fillCircle(px + 16, py + 9, 8);
        g.fillStyle(0xffeeaa); g.fillRect(px + 12, py + 7, 8, 3);
        break;
      case 82: // mailbox
        g.fillStyle(0x666666); g.fillRect(px + 14, py + 20, 4, 12);
        g.fillStyle(0x3366aa); g.fillRect(px + 8, py + 12, 16, 10);
        g.fillStyle(0x2255aa); g.fillRect(px + 8, py + 12, 16, 3);
        break;
      case 85: // bridge
        g.fillStyle(0x9a7850); g.fillRect(px, py, T, T);
        g.fillStyle(0xbb9868); g.fillRect(px, py + 2, T, 4); g.fillRect(px, py + T - 6, T, 4);
        g.fillStyle(0x7a5830); g.fillRect(px + 2, py, 4, T); g.fillRect(px + T - 6, py, 4, T);
        break;

      // ─── Park new elements ───
      case 86: { // Picnic table
        // Table top
        g.fillStyle(0xab8864); g.fillRect(px + 2, py + 10, 28, 12);
        g.fillStyle(0x9a7854); g.fillRect(px + 2, py + 10, 28, 2);
        // Benches on sides
        g.fillStyle(0x9a7854); g.fillRect(px + 4, py + 6, 24, 4);
        g.fillStyle(0x9a7854); g.fillRect(px + 4, py + 22, 24, 4);
        // Legs
        g.fillStyle(0x7a5834); g.fillRect(px + 6, py + 26, 3, 6); g.fillRect(px + 23, py + 26, 3, 6);
        break;
      }
      case 87: { // Swing set
        // Frame
        g.fillStyle(0x6a6a6a); g.fillRect(px + 4, py + 2, 3, 28); g.fillRect(px + 25, py + 2, 3, 28);
        g.fillStyle(0x5a5a5a); g.fillRect(px + 4, py + 2, 24, 3);
        // Swing chains
        g.fillStyle(0x888888); g.fillRect(px + 12, py + 5, 1, 14); g.fillRect(px + 19, py + 5, 1, 14);
        // Seat
        g.fillStyle(0xcc6644); g.fillRect(px + 10, py + 18, 12, 3);
        break;
      }
      case 88: { // Small pavilion/gazebo
        // Roof
        g.fillStyle(0xcc7755); g.fillRect(px, py, T, 10);
        g.fillStyle(0xbb6644); g.fillRect(px + 2, py + 8, T - 4, 3);
        // Posts
        g.fillStyle(0x8a7a6a); g.fillRect(px + 4, py + 10, 3, 20); g.fillRect(px + 25, py + 10, 3, 20);
        // Floor
        g.fillStyle(0xc8b898, 0.6); g.fillRect(px + 2, py + 26, 28, 6);
        break;
      }
      case 89: { // Reeds/cattails (pond edge)
        // Stems
        g.fillStyle(0x6a9a5a);
        g.fillRect(px + 8, py + 10, 2, 18); g.fillRect(px + 14, py + 8, 2, 20); g.fillRect(px + 20, py + 12, 2, 16); g.fillRect(px + 26, py + 14, 2, 14);
        // Cattail heads
        g.fillStyle(0x8a6a4a);
        g.fillRect(px + 7, py + 6, 4, 6); g.fillRect(px + 13, py + 4, 4, 6); g.fillRect(px + 19, py + 8, 4, 6); g.fillRect(px + 25, py + 10, 4, 5);
        break;
      }

      // ─── Cafe/Store furniture ───
      case 90: // cafe counter
        g.fillStyle(0xa87a50); g.fillRect(px + 1, py + 6, T - 2, T - 6);
        g.fillStyle(0xbb9a70); g.fillRect(px, py + 4, T, 4);
        g.fillStyle(0xf8f8f8); g.fillRect(px + 6, py + 10, 4, 5); g.fillRect(px + 14, py + 10, 4, 5); g.fillRect(px + 22, py + 10, 4, 5);
        break;
      case 91: // cafe table
        g.fillStyle(0x6a5a40); g.fillRect(px + 14, py + 18, 4, 10);
        g.fillStyle(0xbb9e7e); g.fillCircle(px + 16, py + 16, 10);
        g.fillStyle(0x9b8060, 0.25); g.fillCircle(px + 16, py + 16, 7);
        break;
      case 92: // store counter
        g.fillStyle(0x7a7a7a); g.fillRect(px + 1, py + 6, T - 2, T - 6);
        g.fillStyle(0x9a9a9a); g.fillRect(px, py + 4, T, 4);
        g.fillStyle(0x7a7a7a); g.fillRect(px + 10, py + 8, 12, 10);
        g.fillStyle(0x44cc44); g.fillRect(px + 12, py + 10, 8, 5);
        break;
      case 93: // shelf
        g.fillStyle(0xab9064); g.fillRect(px + 2, py + 2, 28, 28);
        g.fillStyle(0x6a5a34); g.fillRect(px + 2, py + 14, 28, 2);
        g.fillStyle(0x66cc88); g.fillRect(px + 6, py + 5, 6, 8);
        g.fillStyle(0xff8866); g.fillRect(px + 14, py + 5, 6, 8);
        g.fillStyle(0x66aaee); g.fillRect(px + 22, py + 6, 5, 7);
        g.fillStyle(0xddaa44); g.fillRect(px + 6, py + 18, 8, 8);
        g.fillStyle(0xaa66aa); g.fillRect(px + 18, py + 17, 7, 9);
        break;
    }
  }

  // ─── Villa Type A (warm: terracotta roof, cream walls) ─────
  private drawVillaA(g: Phaser.GameObjects.Graphics, px: number, py: number, rel: number, tx: number, ty: number): void {
    const rx = rel % 4, ry = Math.floor(rel / 4);
    const h = hash(tx, ty);
    const ROOF = 0xcc6655, ROOF_HI = 0xdd7766, ROOF_EDGE = 0xbb5544;
    const WALL = 0xf5e8d0, WALL_TRIM = 0xe8d8c0;
    const WIN = 0xccddee, WIN_FRAME = 0x8a7a6a;
    const DOOR = 0x8b6246, KNOB = 0xccaa44;

    if (ry === 0) { // Roof row
      g.fillStyle(ROOF); g.fillRect(px, py, T, T);
      g.fillStyle(ROOF_HI); g.fillRect(px, py + 2, T, T - 8);
      g.fillStyle(ROOF_EDGE); g.fillRect(px, py + T - 4, T, 4);
      if (rx === 0) { g.fillStyle(ROOF_EDGE); g.fillRect(px, py, 4, T); } // left edge
      if (rx === 3) { g.fillStyle(ROOF_EDGE); g.fillRect(px + T - 4, py, 4, T); } // right edge
      if (rx === 0) {
        // Chimney with smoke effect
        g.fillStyle(0x8a7a6a); g.fillRect(px + 6, py, 6, 10);
        g.fillStyle(0x7a6a5a); g.fillRect(px + 7, py, 4, 8);
        // Smoke puffs (simple static particles)
        if (h % 3 === 0) {
          g.fillStyle(0xcccccc, 0.3); g.fillCircle(px + 9, py - 4, 3);
          g.fillStyle(0xdddddd, 0.2); g.fillCircle(px + 7, py - 8, 2);
          g.fillStyle(0xeeeeee, 0.15); g.fillCircle(px + 10, py - 11, 2);
        }
      }
      // Ridge line
      g.fillStyle(0xbb5544, 0.5); g.fillRect(px, py + 10, T, 2);
    } else if (ry === 1) { // Wall row
      g.fillStyle(WALL); g.fillRect(px, py, T, T);
      g.fillStyle(WALL_TRIM); g.fillRect(px, py, T, 2); // trim at top
      if (rx === 0 || rx === 3) { // edge walls with window
        g.fillStyle(WIN); g.fillRect(px + 8, py + 8, 16, 14);
        g.fillStyle(WIN_FRAME); g.fillRect(px + 8, py + 8, 16, 1); g.fillRect(px + 8, py + 8, 1, 14); g.fillRect(px + 23, py + 8, 1, 14); g.fillRect(px + 8, py + 21, 16, 1);
        g.fillStyle(0x000000, 0.1); g.fillRect(px + 16, py + 8, 1, 14); g.fillRect(px + 8, py + 14, 16, 1);
      } else { // center walls — plain with small detail
        g.fillStyle(WALL_TRIM, 0.3); g.fillRect(px + 4, py + 10, T - 8, 12);
      }
      if (rx === 0) { g.fillStyle(0x9a8a70); g.fillRect(px, py, 2, T); } // left border
      if (rx === 3) { g.fillStyle(0x9a8a70); g.fillRect(px + T - 2, py, 2, T); }
    } else { // Ground row
      g.fillStyle(WALL); g.fillRect(px, py, T, T);
      g.fillStyle(0xc8b8a0); g.fillRect(px, py + T - 4, T, 4); // foundation
      if (rx === 1) { // door
        g.fillStyle(DOOR); g.fillRect(px + 6, py + 2, 20, T - 6);
        g.fillStyle(0x7a5236, 0.4); g.fillRect(px + 10, py + 5, 12, 10); g.fillRect(px + 10, py + 18, 12, 6);
        g.fillStyle(KNOB); g.fillRect(px + 21, py + 16, 3, 3);
      } else if (rx === 2) { // window
        g.fillStyle(WIN); g.fillRect(px + 6, py + 4, 20, 16);
        g.fillStyle(WIN_FRAME); g.fillRect(px + 6, py + 4, 20, 1); g.fillRect(px + 6, py + 19, 20, 1); g.fillRect(px + 6, py + 4, 1, 16); g.fillRect(px + 25, py + 4, 1, 16);
        g.fillStyle(0x000000, 0.1); g.fillRect(px + 16, py + 4, 1, 16); g.fillRect(px + 6, py + 12, 20, 1);
      }
      if (rx === 0) { g.fillStyle(0x9a8a70); g.fillRect(px, py, 2, T); }
      if (rx === 3) { g.fillStyle(0x9a8a70); g.fillRect(px + T - 2, py, 2, T); }
    }
  }

  // ─── Villa Type B (cool: slate blue roof, light gray walls) ─
  private drawVillaB(g: Phaser.GameObjects.Graphics, px: number, py: number, rel: number, tx: number, ty: number): void {
    const rx = rel % 4, ry = Math.floor(rel / 4);
    const h = hash(tx, ty);
    const ROOF = 0x6688aa, ROOF_HI = 0x7799bb, ROOF_EDGE = 0x557799;
    const WALL = 0xe0e8f0, WALL_TRIM = 0xd0d8e0;
    const WIN = 0xccddee, WIN_FRAME = 0x7a8a9a;
    const DOOR = 0x6b4226, KNOB = 0xccaa44;

    if (ry === 0) {
      g.fillStyle(ROOF); g.fillRect(px, py, T, T);
      g.fillStyle(ROOF_HI); g.fillRect(px, py + 2, T, T - 8);
      g.fillStyle(ROOF_EDGE); g.fillRect(px, py + T - 4, T, 4);
      if (rx === 0) { g.fillStyle(ROOF_EDGE); g.fillRect(px, py, 4, T); }
      if (rx === 3) { g.fillStyle(ROOF_EDGE); g.fillRect(px + T - 4, py, 4, T); }
      if (rx === 3) {
        // Chimney with smoke effect
        g.fillStyle(0x7a8a9a); g.fillRect(px + T - 12, py, 6, 10);
        g.fillStyle(0x6a7a8a); g.fillRect(px + T - 11, py, 4, 8);
        // Smoke puffs
        if (h % 4 === 0) {
          g.fillStyle(0xcccccc, 0.25); g.fillCircle(px + T - 9, py - 3, 2.5);
          g.fillStyle(0xdddddd, 0.18); g.fillCircle(px + T - 11, py - 7, 2);
        }
      }
      g.fillStyle(ROOF_EDGE, 0.5); g.fillRect(px, py + 10, T, 2);
    } else if (ry === 1) {
      g.fillStyle(WALL); g.fillRect(px, py, T, T);
      g.fillStyle(WALL_TRIM); g.fillRect(px, py, T, 2);
      if (rx === 0 || rx === 3) {
        g.fillStyle(WIN); g.fillRect(px + 8, py + 8, 16, 14);
        g.fillStyle(WIN_FRAME); g.fillRect(px + 8, py + 8, 16, 1); g.fillRect(px + 8, py + 8, 1, 14); g.fillRect(px + 23, py + 8, 1, 14); g.fillRect(px + 8, py + 21, 16, 1);
        g.fillStyle(0x000000, 0.08); g.fillRect(px + 16, py + 8, 1, 14); g.fillRect(px + 8, py + 14, 16, 1);
      } else {
        g.fillStyle(WALL_TRIM, 0.3); g.fillRect(px + 4, py + 10, T - 8, 12);
      }
      if (rx === 0) { g.fillStyle(0x8a9aaa); g.fillRect(px, py, 2, T); }
      if (rx === 3) { g.fillStyle(0x8a9aaa); g.fillRect(px + T - 2, py, 2, T); }
    } else {
      g.fillStyle(WALL); g.fillRect(px, py, T, T);
      g.fillStyle(0xc0c8d0); g.fillRect(px, py + T - 4, T, 4);
      if (rx === 1) {
        g.fillStyle(DOOR); g.fillRect(px + 6, py + 2, 20, T - 6);
        g.fillStyle(0x5a3218, 0.4); g.fillRect(px + 10, py + 5, 12, 10); g.fillRect(px + 10, py + 18, 12, 6);
        g.fillStyle(KNOB); g.fillRect(px + 21, py + 16, 3, 3);
      } else if (rx === 2) {
        g.fillStyle(WIN); g.fillRect(px + 6, py + 4, 20, 16);
        g.fillStyle(WIN_FRAME); g.fillRect(px + 6, py + 4, 20, 1); g.fillRect(px + 6, py + 19, 20, 1); g.fillRect(px + 6, py + 4, 1, 16); g.fillRect(px + 25, py + 4, 1, 16);
        g.fillStyle(0x000000, 0.08); g.fillRect(px + 16, py + 4, 1, 16); g.fillRect(px + 6, py + 12, 20, 1);
      }
      if (rx === 0) { g.fillStyle(0x8a9aaa); g.fillRect(px, py, 2, T); }
      if (rx === 3) { g.fillStyle(0x8a9aaa); g.fillRect(px + T - 2, py, 2, T); }
    }
  }

  // ─── Villa Type C (green: forest green roof, warm beige walls) ─
  private drawVillaC(g: Phaser.GameObjects.Graphics, px: number, py: number, rel: number, tx: number, ty: number): void {
    const rx = rel % 4, ry = Math.floor(rel / 4);
    const h = hash(tx, ty);
    const ROOF = 0x4a8a5a, ROOF_HI = 0x5a9a6a, ROOF_EDGE = 0x3a7a4a;
    const WALL = 0xf0e8d8, WALL_TRIM = 0xe0d8c8;
    const WIN = 0xccddee, WIN_FRAME = 0x7a8a7a;
    const DOOR = 0x7b5236, KNOB = 0xccaa44;

    if (ry === 0) { // Roof row
      g.fillStyle(ROOF); g.fillRect(px, py, T, T);
      g.fillStyle(ROOF_HI); g.fillRect(px, py + 2, T, T - 8);
      g.fillStyle(ROOF_EDGE); g.fillRect(px, py + T - 4, T, 4);
      if (rx === 0) { g.fillStyle(ROOF_EDGE); g.fillRect(px, py, 4, T); }
      if (rx === 3) { g.fillStyle(ROOF_EDGE); g.fillRect(px + T - 4, py, 4, T); }
      // Chimney on center-left
      if (rx === 1) {
        g.fillStyle(0x8a8a7a); g.fillRect(px + 4, py, 6, 10);
        g.fillStyle(0x7a7a6a); g.fillRect(px + 5, py, 4, 8);
        // Smoke puffs
        if (h % 2 === 0) {
          g.fillStyle(0xcccccc, 0.28); g.fillCircle(px + 7, py - 4, 2.5);
          g.fillStyle(0xdddddd, 0.2); g.fillCircle(px + 5, py - 8, 2);
          g.fillStyle(0xeeeeee, 0.12); g.fillCircle(px + 8, py - 12, 1.5);
        }
      }
      // Ridge line
      g.fillStyle(ROOF_EDGE, 0.5); g.fillRect(px, py + 10, T, 2);
    } else if (ry === 1) { // Wall row
      g.fillStyle(WALL); g.fillRect(px, py, T, T);
      g.fillStyle(WALL_TRIM); g.fillRect(px, py, T, 2);
      if (rx === 0 || rx === 3) {
        g.fillStyle(WIN); g.fillRect(px + 8, py + 8, 16, 14);
        g.fillStyle(WIN_FRAME); g.fillRect(px + 8, py + 8, 16, 1); g.fillRect(px + 8, py + 8, 1, 14); g.fillRect(px + 23, py + 8, 1, 14); g.fillRect(px + 8, py + 21, 16, 1);
        g.fillStyle(0x000000, 0.1); g.fillRect(px + 16, py + 8, 1, 14); g.fillRect(px + 8, py + 14, 16, 1);
      } else {
        g.fillStyle(WALL_TRIM, 0.3); g.fillRect(px + 4, py + 10, T - 8, 12);
      }
      if (rx === 0) { g.fillStyle(0x8a9a8a); g.fillRect(px, py, 2, T); }
      if (rx === 3) { g.fillStyle(0x8a9a8a); g.fillRect(px + T - 2, py, 2, T); }
    } else { // Ground row
      g.fillStyle(WALL); g.fillRect(px, py, T, T);
      g.fillStyle(0xc8c0b0); g.fillRect(px, py + T - 4, T, 4); // foundation
      if (rx === 1) { // door
        g.fillStyle(DOOR); g.fillRect(px + 6, py + 2, 20, T - 6);
        g.fillStyle(0x6a4228, 0.4); g.fillRect(px + 10, py + 5, 12, 10); g.fillRect(px + 10, py + 18, 12, 6);
        g.fillStyle(KNOB); g.fillRect(px + 21, py + 16, 3, 3);
      } else if (rx === 2) { // window
        g.fillStyle(WIN); g.fillRect(px + 6, py + 4, 20, 16);
        g.fillStyle(WIN_FRAME); g.fillRect(px + 6, py + 4, 20, 1); g.fillRect(px + 6, py + 19, 20, 1); g.fillRect(px + 6, py + 4, 1, 16); g.fillRect(px + 25, py + 4, 1, 16);
        g.fillStyle(0x000000, 0.1); g.fillRect(px + 16, py + 4, 1, 16); g.fillRect(px + 6, py + 12, 20, 1);
      }
      if (rx === 0) { g.fillStyle(0x8a9a8a); g.fillRect(px, py, 2, T); }
      if (rx === 3) { g.fillStyle(0x8a9a8a); g.fillRect(px + T - 2, py, 2, T); }
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  AREA LABELS
  // ═══════════════════════════════════════════════════════════

  private renderAreaLabels(): void {
    if (!this.map.areas) return;
    for (const [, area] of Object.entries(this.map.areas)) {
      const cx = (area.x + area.width / 2) * T;
      const cy = area.y * T - 4;
      const label = this.scene.add.text(cx, cy, area.name.toUpperCase(), {
        fontSize: '10px',
        fontFamily: '"Press Start 2P", monospace',
        color: '#ffffff',
        backgroundColor: 'rgba(0,0,0,0.4)',
        padding: { x: 6, y: 3 },
      });
      label.setOrigin(0.5, 1).setDepth(90).setAlpha(0.75);
    }
  }
}
