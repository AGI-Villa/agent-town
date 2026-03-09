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
  constructor(scene: Phaser.Scene, map: MapData) { this.scene = scene; this.map = map; }

  renderAll(): void {
    this.renderGround();
    this.renderFurniture();
    this.renderAreaLabels();
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

      case 3: { // Grass — SINGLE base, subtle micro-variation
        g.fillStyle(0x6aba6e); g.fillRect(px, py, T, T);
        // Micro patch — very subtle, same family green
        g.fillStyle(0x62b266, 0.12);
        g.fillRect(px + (h % 14) + 2, py + ((h >> 4) % 14) + 2, 16 + (h % 6), 14 + ((h >> 8) % 6));
        // Grass blade
        g.fillStyle(0x78cc7a, 0.22);
        g.fillRect(px + (h % 24) + 3, py + ((h >> 3) % 20) + 5, 1, 3);
        if (h % 5 === 0) {
          g.fillRect(px + ((h >> 6) % 20) + 6, py + ((h >> 9) % 16) + 8, 1, 4);
        }
        break;
      }

      case 4: { // Cobblestone road
        g.fillStyle(0x8a8890); g.fillRect(px, py, T, T);
        const sc = [0x969494, 0x8a8888, 0x7e7c7c, 0x908e8e];
        g.fillStyle(sc[h % 4], 0.65);
        g.fillRect(px + 1, py + 1, 14, 14);
        g.fillStyle(sc[(h >> 4) % 4], 0.65);
        g.fillRect(px + 17, py + 1, 14, 14);
        g.fillStyle(sc[(h >> 8) % 4], 0.65);
        g.fillRect(px + 1, py + 17, 14, 14);
        g.fillStyle(sc[(h >> 12) % 4], 0.65);
        g.fillRect(px + 17, py + 17, 14, 14);
        g.fillStyle(0x6a6868, 0.35);
        g.fillRect(px + 15, py, 2, T); g.fillRect(px, py + 15, T, 2);
        break;
      }

      case 5: { // Wood floor (cafe)
        g.fillStyle(0xb8885a); g.fillRect(px, py, T, T);
        g.fillStyle(0xc89868, 0.45);
        g.fillRect(px + (tx % 2) * 16, py, 16, T);
        g.fillStyle(0xa07848, 0.3);
        g.fillRect(px, py + 7, T, 1); g.fillRect(px, py + 15, T, 1); g.fillRect(px, py + 23, T, 1);
        break;
      }

      case 6: { // Tile floor (store)
        g.fillStyle(0xe0dcd0); g.fillRect(px, py, T, T);
        g.fillStyle(0xd0ccc0, 0.45);
        g.fillRect(px + 1, py + 1, 14, 14); g.fillRect(px + 17, py + 17, 14, 14);
        g.fillStyle(0xc8c4b8, 0.25);
        g.fillRect(px + 15, py, 2, T); g.fillRect(px, py + 15, T, 2);
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

      case 11: { // Dirt path
        g.fillStyle(0xb8a078); g.fillRect(px, py, T, T);
        g.fillStyle(0xa89068, 0.3);
        g.fillRect(px + (h % 10) + 6, py + ((h >> 4) % 14) + 6, 12, 10);
        // Grass edges at top/bottom
        g.fillStyle(0x6aba6e, 0.25);
        g.fillRect(px, py, T, 3); g.fillRect(px, py + T - 3, T, 3);
        break;
      }

      case 12: { // Plaza cobblestone (warm, decorative)
        g.fillStyle(0xc8b898); g.fillRect(px, py, T, T);
        g.fillStyle(0xd8c8a8, 0.45);
        g.fillRect(px + 1, py + 1, 14, 14); g.fillRect(px + 17, py + 17, 14, 14);
        g.fillStyle(0xb8a888, 0.45);
        g.fillRect(px + 17, py + 1, 14, 14); g.fillRect(px + 1, py + 17, 14, 14);
        g.fillStyle(0xa89878, 0.25);
        g.fillRect(px + 15, py, 2, T); g.fillRect(px, py + 15, T, 2);
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
    if (tile >= 100 && tile <= 111) { this.drawVillaA(g, px, py, tile - 100); return; }
    if (tile >= 112 && tile <= 123) { this.drawVillaB(g, px, py, tile - 112); return; }

    switch (tile) {
      // ─── Walls (warm stone, thin band) ───
      case 10: // top wall — thin band at bottom, roof hint at top
        g.fillStyle(0xb8a888, 0.15); g.fillRect(px, py, T, T - 6);
        g.fillStyle(0x9a8a70); g.fillRect(px, py + T - 8, T, 8);
        g.fillStyle(0xb0a080); g.fillRect(px, py + T - 6, T, 2);
        g.fillStyle(0xc0b090, 0.5); g.fillRect(px, py + T - 2, T, 2);
        break;
      case 11: // bottom wall
        g.fillStyle(0x9a8a70); g.fillRect(px, py, T, 8);
        g.fillStyle(0xb0a080); g.fillRect(px, py + 4, T, 2);
        g.fillStyle(0xb8a888, 0.15); g.fillRect(px, py + 8, T, T - 8);
        break;
      case 12: // left wall
        g.fillStyle(0x9a8a70); g.fillRect(px + T - 8, py, 8, T);
        g.fillStyle(0xb0a080); g.fillRect(px + T - 6, py, 2, T);
        g.fillStyle(0xb8a888, 0.12); g.fillRect(px, py, T - 8, T);
        break;
      case 13: // right wall
        g.fillStyle(0x9a8a70); g.fillRect(px, py, 8, T);
        g.fillStyle(0xb0a080); g.fillRect(px + 4, py, 2, T);
        g.fillStyle(0xb8a888, 0.12); g.fillRect(px + 8, py, T - 8, T);
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
      case 60: // door
        g.fillStyle(0x8b6246); g.fillRect(px + 6, py + 2, 20, T - 2);
        g.fillStyle(0x7a5236, 0.5); g.fillRect(px + 9, py + 5, 14, 10); g.fillRect(px + 9, py + 18, 14, 10);
        g.fillStyle(0xccaa44); g.fillRect(px + 21, py + 16, 3, 4);
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
  private drawVillaA(g: Phaser.GameObjects.Graphics, px: number, py: number, rel: number): void {
    const rx = rel % 4, ry = Math.floor(rel / 4);
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
      if (rx === 0) { g.fillStyle(0x8a7a6a); g.fillRect(px + 6, py, 6, 10); g.fillStyle(0x7a6a5a); g.fillRect(px + 7, py, 4, 8); } // chimney
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
  private drawVillaB(g: Phaser.GameObjects.Graphics, px: number, py: number, rel: number): void {
    const rx = rel % 4, ry = Math.floor(rel / 4);
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
      if (rx === 3) { g.fillStyle(0x7a8a9a); g.fillRect(px + T - 12, py, 6, 10); g.fillStyle(0x6a7a8a); g.fillRect(px + T - 11, py, 4, 8); }
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
