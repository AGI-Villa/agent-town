// Town tilemap data (60x45 tiles)
// Layout: plaza-centered with organic flow
//   Top: Forest frame + Park (with organic pond)
//   Middle: Office | Plaza (open) | Cafe | Store — along main road
//   Bottom: Residential villas along dirt path, river, south meadow

const W = 60, H = 45;

// Deterministic hash for pseudo-random placement
function hash(x: number, y: number): number {
  let h = x * 374761393 + y * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  return (h ^ (h >> 16)) >>> 0;
}

// Villa definitions: origin (top-left), 4 wide x 3 tall
const VILLAS: { ox: number; oy: number; type: 'A' | 'B' }[] = [
  { ox: 5,  oy: 29, type: 'A' },
  { ox: 13, oy: 29, type: 'B' },
  { ox: 21, oy: 29, type: 'A' },
  { ox: 29, oy: 29, type: 'B' },
  { ox: 37, oy: 29, type: 'A' },
  { ox: 45, oy: 29, type: 'B' },
];
const VILLA_A_BASE = 100;
const VILLA_B_BASE = 112;

// ─── Pond shape (organic blob in park) ────────────────────────
function isPond(x: number, y: number): boolean {
  if (y === 4) return x >= 26 && x <= 29;
  if (y === 5) return x >= 25 && x <= 30;
  if (y === 6) return x >= 24 && x <= 31;
  if (y === 7) return x >= 23 && x <= 31;
  if (y === 8) return x >= 24 && x <= 30;
  if (y === 9) return x >= 25 && x <= 29;
  if (y === 10) return x >= 27 && x <= 28;
  return false;
}

function isPondEdge(x: number, y: number): boolean {
  if (isPond(x, y)) return false;
  for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
    if (isPond(x + dx, y + dy)) return true;
  }
  return false;
}

// ─── Forest areas ─────────────────────────────────────────────
function isForest(x: number, y: number): boolean {
  if (y === 0) return true;
  if (x <= 1 && y <= 33) return true;
  if (x >= 56 && y <= 33) return true;
  if (y <= 12 && x <= 14) return true;  // NW of park
  if (y <= 12 && x >= 40) return true;  // NE of park
  if (y >= 40) return true;             // south of river
  if (y >= 34 && y <= 38 && (x <= 3 || x >= 54)) return true; // river edges
  return false;
}

// ─── Ground layer ─────────────────────────────────────────────
// 0/1: office floor, 2: carpet, 3: grass, 4: cobblestone road,
// 5: wood floor, 6: tile floor, 7: water, 8: forest floor,
// 9: stone path, 10: riverbank, 11: dirt path, 12: plaza cobblestone
function getGround(x: number, y: number): number {
  // === Roads (highest priority — cut through everything) ===
  // Main E-W road
  if (y >= 13 && y <= 14 && x >= 2 && x <= 55) {
    if (x >= 16 && x <= 23) return 12; // blends into plaza
    return 4;
  }
  // Main N-S avenue
  if (x >= 20 && x <= 21 && y >= 1 && y <= 33) {
    if (y >= 15 && y <= 22) return 12; // blends into plaza
    return 4;
  }
  // Residential dirt path
  if (y >= 27 && y <= 28 && x >= 4 && x <= 51) return 11;

  // === Building interiors ===
  // Office (walls at x:2,13 y:15,24; interior x:3-12, y:16-23)
  if (x >= 3 && x <= 12 && y >= 16 && y <= 23) {
    if (x >= 8 && x <= 11 && y >= 21 && y <= 23) return 2; // meeting carpet
    return (x + y) % 2 === 0 ? 0 : 1;
  }
  // Cafe interior (walls at x:28,37 y:15,23; interior x:29-36, y:16-22)
  if (x >= 29 && x <= 36 && y >= 16 && y <= 22) return 5;
  // Store interior (walls at x:41,50 y:15,23; interior x:42-49, y:16-22)
  if (x >= 42 && x <= 49 && y >= 16 && y <= 22) return 6;
  // Plaza (open cobblestone, no walls)
  if (x >= 16 && x <= 23 && y >= 15 && y <= 22) return 12;

  // === Water ===
  if (isPond(x, y)) return 7;
  if (isPondEdge(x, y) && y >= 1 && y <= 12) return 9;
  if (y >= 35 && y <= 37) return 7;  // river
  if (y === 34 || y === 38) return 10; // riverbank

  // === Forest ===
  if (isForest(x, y)) return 8;

  // === Everything else: grass ===
  return 3;
}

// ─── Furniture layer ──────────────────────────────────────────
function getFurniture(x: number, y: number): number {
  const g = getGround(x, y);

  // ── Office (x:2-13, y:15-24) ──
  if (x >= 2 && x <= 13 && y >= 15 && y <= 24) {
    // Walls
    if (y === 15 && x >= 2 && x <= 13) { if (x === 7) return 60; return 10; }
    if (y === 24) return 11;
    if (x === 2 && y > 15 && y < 24) return 12;
    if (x === 13 && y > 15 && y < 24) return 13;
    // Interior furniture
    if ((x === 4 || x === 7 || x === 10) && (y === 17 || y === 20)) return 20; // desk
    if ((x === 5 || x === 8 || x === 11) && (y === 17 || y === 20)) return 28; // monitor
    if ((x === 4 || x === 7 || x === 10) && (y === 18 || y === 21)) return 24; // chair
    if (x === 9 && y === 22) return 50;  // meeting table
    if (x === 10 && y === 22) return 50;
    if (x === 4 && y === 23) return 40;  // coffee machine
    if (x === 5 && y === 23) return 41;  // counter
    if (x === 3 && y === 16) return 44;  // plant
    if (x === 12 && y === 16) return 44; // plant
    if (x === 11 && y === 17) return 54; // whiteboard
  }

  // ── Plaza (x:16-23, y:15-22) — open air ──
  if (x >= 16 && x <= 23 && y >= 15 && y <= 22) {
    // Fountain at center
    if ((x === 19 || x === 20) && (y === 18 || y === 19)) return 74;
    // Benches around fountain
    if (x === 17 && y === 18) return 73;
    if (x === 22 && y === 18) return 73;
    if (x === 17 && y === 20) return 73;
    if (x === 22 && y === 20) return 73;
    // Lamp posts at corners
    if (x === 16 && y === 15) return 81;
    if (x === 23 && y === 15) return 81;
    if (x === 16 && y === 22) return 81;
    if (x === 23 && y === 22) return 81;
    // Flower beds
    if (x === 18 && y === 16) return 75;
    if (x === 21 && y === 16) return 75;
    if (x === 18 && y === 21) return 75;
    if (x === 21 && y === 21) return 75;
  }

  // ── Cafe (x:28-37, y:15-23) ──
  if (x >= 28 && x <= 37 && y >= 15 && y <= 23) {
    if (y === 15) { if (x === 32) return 60; return 10; }
    if (y === 23) return 11;
    if (x === 28 && y > 15 && y < 23) return 12;
    if (x === 37 && y > 15 && y < 23) return 13;
    if (x >= 31 && x <= 34 && y === 17) return 90; // counter
    if (x === 36 && y === 16) return 40; // coffee machine
    if (x === 29 && y === 16) return 44; // plant
    if ((x === 30 || x === 34) && y === 19) return 91; // table
    if ((x === 30 || x === 34) && y === 21) return 91;
    if (x === 32 && y === 20) return 91;
    if ((x === 29 || x === 31 || x === 33 || x === 35) && y === 19) return 24; // chairs
    if ((x === 29 || x === 31 || x === 33 || x === 35) && y === 21) return 24;
    if (x === 36 && y === 22) return 44; // plant
  }

  // ── Store (x:41-50, y:15-23) ──
  if (x >= 41 && x <= 50 && y >= 15 && y <= 23) {
    if (y === 15) { if (x === 45) return 60; return 10; }
    if (y === 23) return 11;
    if (x === 41 && y > 15 && y < 23) return 12;
    if (x === 50 && y > 15 && y < 23) return 13;
    if (x >= 43 && x <= 47 && y === 17) return 92; // counter
    if ((x === 43 || x === 46 || x === 49) && (y === 19 || y === 21)) return 93; // shelves
    if (x === 42 && y === 16) return 44; // plant
  }

  // ── Park (x:15-38, y:1-12) ──
  if (x >= 15 && x <= 38 && y >= 1 && y <= 12 && g === 3) {
    // Park fence (soft, only at edges)
    if (y === 1 && x >= 15 && x <= 38) return 70;
    if (y === 12 && x >= 15 && x <= 38) return 70;
    if (x === 15 && y >= 1 && y <= 12) return 71;
    if (x === 38 && y >= 1 && y <= 12) return 71;
    // Trees along edges (varied sizes via different positions)
    if ((x === 16 || x === 18 || x === 35 || x === 37) && y === 2) return 72;
    if ((x === 16 || x === 37) && y === 11) return 72;
    if (x === 19 && y === 3) return 72;
    if (x === 34 && y === 3) return 72;
    // Additional trees for density
    if (x === 17 && y === 6) return 72;
    if (x === 36 && y === 6) return 72;
    // Benches
    if (x === 18 && y === 5) return 73;
    if (x === 33 && y === 5) return 73;
    if (x === 22 && y === 3) return 73;
    if (x === 20 && y === 10) return 73;
    if (x === 32 && y === 10) return 73;
    if (x === 36 && y === 8) return 73;
    // Picnic table
    if (x === 35 && y === 4) return 86;
    // Swing set
    if (x === 17 && y === 8) return 87;
    // Small pavilion
    if (x === 33 && y === 8) return 88;
    // Flowers scattered
    if (x === 17 && y === 4) return 75;
    if (x === 22 && y === 8) return 75;
    if (x === 34 && y === 4) return 75;
    if (x === 36 && y === 10) return 75;
    if (x === 17 && y === 9) return 75;
    if (x === 32 && y === 3) return 75;
    // Bushes for variety
    if (x === 19 && y === 5) return 76;
    if (x === 34 && y === 9) return 76;
    // Wildflowers
    if (x === 21 && y === 4) return 78;
    if (x === 31 && y === 4) return 78;
    if (x === 19 && y === 10) return 78;
  }

  // ── Pond edge reeds ──
  if (isPondEdge(x, y) && y >= 1 && y <= 12) {
    // Add reeds on some pond edges
    if ((x === 23 && y === 7) || (x === 31 && y === 7) || (x === 25 && y === 9) || (x === 29 && y === 9)) return 89;
  }

  // ── Villas (position-aware multi-tile rendering) ──
  for (const v of VILLAS) {
    const rx = x - v.ox, ry = y - v.oy;
    if (rx >= 0 && rx < 4 && ry >= 0 && ry < 3) {
      const base = v.type === 'A' ? VILLA_A_BASE : VILLA_B_BASE;
      return base + ry * 4 + rx;
    }
  }

  // ── Residential decorations (gardens between villas) ──
  if (y >= 27 && y <= 33 && x >= 4 && x <= 51 && g === 3) {
    // Trees between villas
    if (y === 30 && (x === 11 || x === 19 || x === 27 || x === 35 || x === 43)) return 72;
    // Flower beds near villas
    if (y === 32 && (x === 7 || x === 15 || x === 23 || x === 31 || x === 39 || x === 47)) return 75;
    // Garden bushes
    if (y === 28 && (x === 9 || x === 17 || x === 25 || x === 33 || x === 41 || x === 49)) return 76;
    // Lamp posts along path
    if (y === 27 && (x === 5 || x === 13 || x === 21 || x === 29 || x === 37 || x === 45)) return 81;
    // Mailboxes in front of villas
    if (y === 32 && (x === 6 || x === 14 || x === 22 || x === 30 || x === 38 || x === 46)) return 82;
  }

  // ── Bridge over river ──
  if (y >= 35 && y <= 37 && x >= 20 && x <= 21) return 85;

  // ── Forest decorations ──
  if (g === 8) {
    const h = hash(x, y) % 10;
    if (h < 4) return 72;  // tree 40%
    if (h === 4) return 76; // bush
    if (h === 5) return 77; // rock
    return -1; // bare forest floor
  }

  // ── Gaps between buildings: green buffers ──
  if (y >= 15 && y <= 24) {
    // Between office and plaza (x:14-15)
    if (x === 14 && y === 16) return 72;
    if (x === 15 && y === 19) return 72;
    if (x === 14 && y === 21) return 76;
    if (x === 15 && y === 17) return 75;
    // Between plaza and cafe (x:24-27)
    if (x === 24 && y === 17) return 72;
    if (x === 26 && y === 16) return 72;
    if (x === 25 && y === 19) return 76;
    if (x === 27 && y === 20) return 75;
    if (x === 24 && y === 22) return 76;
    if (x === 26 && y === 21) return 75;
    // Between cafe and store (x:38-40)
    if (x === 38 && y === 17) return 72;
    if (x === 40 && y === 16) return 72;
    if (x === 39 && y === 19) return 76;
    if (x === 38 && y === 21) return 75;
    if (x === 40 && y === 22) return 76;
  }

  // ── Road-side trees along main road ──
  if (y === 12 && g === 3) {
    if (x === 4 || x === 8 || x === 12 || x === 25 || x === 35 || x === 44 || x === 52) return 72;
  }

  // ── Scattered grass decorations ──
  if (g === 3) {
    const h = hash(x, y) % 120;
    if (h < 2) return 76;  // bush ~1.7%
    if (h < 4) return 78;  // wildflowers ~1.7%
    if (h < 5) return 77;  // rock ~0.8%
    if (h < 6) return 79;  // grass tuft ~0.8%
  }

  return -1;
}

// ─── Layer generators ─────────────────────────────────────────
function generateGroundLayer(): number[][] {
  const layer: number[][] = [];
  for (let y = 0; y < H; y++) {
    const row: number[] = [];
    for (let x = 0; x < W; x++) row.push(getGround(x, y));
    layer.push(row);
  }
  return layer;
}

function generateFurnitureLayer(): number[][] {
  const layer: number[][] = [];
  for (let y = 0; y < H; y++) {
    const row: number[] = [];
    for (let x = 0; x < W; x++) row.push(getFurniture(x, y));
    layer.push(row);
  }
  return layer;
}

function generateCollisionLayer(): number[][] {
  const layer: number[][] = [];
  for (let y = 0; y < H; y++) {
    const row: number[] = [];
    for (let x = 0; x < W; x++) {
      const f = getFurniture(x, y);
      const g = getGround(x, y);
      if (g === 7) { row.push(1); continue; }  // water
      if (g === 8) { row.push(1); continue; }  // forest (impassable)
      if (f === 60 || f === 85) { row.push(0); continue; } // doors & bridges
      if (f >= 100 && f <= 123) { row.push(1); continue; } // villa body
      const solidFurniture = [10, 11, 12, 13, 20, 28, 40, 50, 54, 70, 71, 72, 74, 90, 92, 93];
      if (solidFurniture.includes(f)) { row.push(1); continue; }
      row.push(0);
    }
    layer.push(row);
  }
  return layer;
}

// ─── Export ───────────────────────────────────────────────────
export const TOWN_MAP = {
  width: W,
  height: H,
  tileWidth: 32,
  tileHeight: 32,

  areas: {
    office:     { x: 2,  y: 15, width: 12, height: 10, name: 'Office' },
    park:       { x: 15, y: 1,  width: 24, height: 12, name: 'Park' },
    plaza:      { x: 16, y: 15, width: 8,  height: 8,  name: 'Town Plaza' },
    coffeeShop: { x: 28, y: 15, width: 10, height: 9,  name: 'Cafe' },
    store:      { x: 41, y: 15, width: 10, height: 9,  name: 'Store' },
    residential:{ x: 4,  y: 27, width: 48, height: 7,  name: 'Residential' },
  },

  layers: {
    ground: generateGroundLayer(),
    furniture: generateFurnitureLayer(),
    collision: generateCollisionLayer(),
  },

  locations: {
    officeEntrance: { x: 7, y: 14, area: 'office' },
    coffeeArea: { x: 4, y: 23, area: 'office' },
    meetingRoom: { x: 9, y: 22, area: 'office' },
    workstations: [
      { x: 4, y: 17, id: 'desk-1', area: 'office' },
      { x: 7, y: 17, id: 'desk-2', area: 'office' },
      { x: 10, y: 17, id: 'desk-3', area: 'office' },
      { x: 4, y: 20, id: 'desk-4', area: 'office' },
      { x: 7, y: 20, id: 'desk-5', area: 'office' },
      { x: 10, y: 20, id: 'desk-6', area: 'office' },
    ],
    parkBenches: [
      { x: 18, y: 5, id: 'bench-1', area: 'park' },
      { x: 33, y: 5, id: 'bench-2', area: 'park' },
      { x: 22, y: 3, id: 'bench-3', area: 'park' },
      { x: 20, y: 10, id: 'bench-4', area: 'park' },
      { x: 32, y: 10, id: 'bench-5', area: 'park' },
      { x: 36, y: 8, id: 'bench-6', area: 'park' },
    ],
    plazaBenches: [
      { x: 17, y: 18, id: 'plaza-1', area: 'plaza' },
      { x: 22, y: 18, id: 'plaza-2', area: 'plaza' },
      { x: 17, y: 20, id: 'plaza-3', area: 'plaza' },
      { x: 22, y: 20, id: 'plaza-4', area: 'plaza' },
    ],
    homes: [
      { x: 6,  y: 32, id: 'villa-1', area: 'residential' },
      { x: 14, y: 32, id: 'villa-2', area: 'residential' },
      { x: 22, y: 32, id: 'villa-3', area: 'residential' },
      { x: 30, y: 32, id: 'villa-4', area: 'residential' },
      { x: 38, y: 32, id: 'villa-5', area: 'residential' },
      { x: 46, y: 32, id: 'villa-6', area: 'residential' },
    ],
    cafeTables: [
      { x: 30, y: 19, id: 'cafe-1', area: 'coffeeShop' },
      { x: 34, y: 19, id: 'cafe-2', area: 'coffeeShop' },
      { x: 30, y: 21, id: 'cafe-3', area: 'coffeeShop' },
      { x: 34, y: 21, id: 'cafe-4', area: 'coffeeShop' },
      { x: 32, y: 20, id: 'cafe-5', area: 'coffeeShop' },
    ],
  },
};

export type TownArea = keyof typeof TOWN_MAP.areas;
export type TownLocation = keyof typeof TOWN_MAP.locations;
