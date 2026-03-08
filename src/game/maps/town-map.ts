// Town tilemap data (40x30 tiles) - expanded from office
// Includes: Office, Park, Residential, Coffee Shop, Store

export const TOWN_MAP = {
  width: 40,
  height: 30,
  tileWidth: 32,
  tileHeight: 32,

  // Area definitions for navigation
  areas: {
    office: { x: 0, y: 0, width: 20, height: 15, name: 'Office' },
    park: { x: 20, y: 0, width: 20, height: 15, name: 'Park' },
    residential: { x: 0, y: 15, width: 20, height: 15, name: 'Residential' },
    coffeeShop: { x: 20, y: 15, width: 10, height: 15, name: 'Coffee Shop' },
    store: { x: 30, y: 15, width: 10, height: 15, name: 'Store' },
  },

  layers: {
    // Ground layer
    ground: generateGroundLayer(),
    // Furniture/objects layer
    furniture: generateFurnitureLayer(),
    // Collision layer
    collision: generateCollisionLayer(),
  },

  // Named locations for spawning/navigation
  locations: {
    // Office area
    officeEntrance: { x: 9, y: 13, area: 'office' },
    coffeeArea: { x: 2, y: 11, area: 'office' },
    meetingRoom: { x: 10, y: 10, area: 'office' },
    workstations: [
      { x: 2, y: 2, id: 'desk-1', area: 'office' },
      { x: 6, y: 2, id: 'desk-2', area: 'office' },
      { x: 2, y: 5, id: 'desk-3', area: 'office' },
      { x: 6, y: 5, id: 'desk-4', area: 'office' },
      { x: 2, y: 8, id: 'desk-5', area: 'office' },
      { x: 6, y: 8, id: 'desk-6', area: 'office' },
    ],
    // Park area
    parkBench1: { x: 25, y: 5, area: 'park' },
    parkBench2: { x: 32, y: 8, area: 'park' },
    fountain: { x: 28, y: 7, area: 'park' },
    // Residential area
    house1: { x: 3, y: 18, area: 'residential' },
    house2: { x: 10, y: 18, area: 'residential' },
    house3: { x: 3, y: 24, area: 'residential' },
    // Coffee shop
    coffeeCounter: { x: 24, y: 20, area: 'coffeeShop' },
    coffeeSeating: { x: 22, y: 24, area: 'coffeeShop' },
    // Store
    storeCounter: { x: 34, y: 20, area: 'store' },
  },
};

function generateGroundLayer(): number[][] {
  const layer: number[][] = [];
  
  for (let y = 0; y < 30; y++) {
    const row: number[] = [];
    for (let x = 0; x < 40; x++) {
      // Office area (0-19, 0-14)
      if (x < 20 && y < 15) {
        row.push(getOfficeFloor(x, y));
      }
      // Park area (20-39, 0-14)
      else if (x >= 20 && y < 15) {
        row.push(getParkFloor(x, y));
      }
      // Residential area (0-19, 15-29)
      else if (x < 20 && y >= 15) {
        row.push(getResidentialFloor(x, y));
      }
      // Coffee shop (20-29, 15-29)
      else if (x >= 20 && x < 30 && y >= 15) {
        row.push(getCoffeeShopFloor(x, y));
      }
      // Store (30-39, 15-29)
      else {
        row.push(getStoreFloor(x, y));
      }
    }
    layer.push(row);
  }
  
  return layer;
}

function getOfficeFloor(x: number, y: number): number {
  // Meeting room carpet
  if (x >= 10 && x <= 13 && y >= 9 && y <= 12) return 2;
  // Checkerboard pattern
  return (x + y) % 2 === 0 ? 0 : 1;
}

function getParkFloor(x: number, y: number): number {
  // Grass (tile 3)
  return 3;
}

function getResidentialFloor(x: number, y: number): number {
  // Road
  if (y === 15 || y === 22) return 4;
  if (x === 8 || x === 15) return 4;
  // Grass
  return 3;
}

function getCoffeeShopFloor(x: number, y: number): number {
  // Wooden floor (tile 5)
  return 5;
}

function getStoreFloor(x: number, y: number): number {
  // Tile floor (tile 6)
  return 6;
}

function generateFurnitureLayer(): number[][] {
  const layer: number[][] = [];
  
  for (let y = 0; y < 30; y++) {
    const row: number[] = [];
    for (let x = 0; x < 40; x++) {
      row.push(getFurniture(x, y));
    }
    layer.push(row);
  }
  
  return layer;
}

function getFurniture(x: number, y: number): number {
  // Office walls
  if (x < 20 && y < 15) {
    if (y === 0) return 10; // Top wall
    if (y === 14) return 11; // Bottom wall
    if (x === 0) return 12; // Left wall
    if (x === 19) return 13; // Right wall
    // Office furniture
    if (x === 2 && y === 2) return 20; // Desk
    if (x === 3 && y === 2) return 28; // Computer
    if (x === 2 && y === 3) return 24; // Chair
    if (x === 6 && y === 2) return 20;
    if (x === 7 && y === 2) return 28;
    if (x === 6 && y === 3) return 24;
    if (x === 2 && y === 5) return 20;
    if (x === 3 && y === 5) return 28;
    if (x === 2 && y === 6) return 24;
    if (x === 6 && y === 5) return 20;
    if (x === 7 && y === 5) return 28;
    if (x === 6 && y === 6) return 24;
    if (x === 2 && y === 8) return 20;
    if (x === 3 && y === 8) return 28;
    if (x === 2 && y === 9) return 24;
    if (x === 6 && y === 8) return 20;
    if (x === 7 && y === 8) return 28;
    if (x === 6 && y === 9) return 24;
    // Meeting table
    if ((x === 10 || x === 11) && (y === 9 || y === 10)) return 50;
    // Coffee area
    if (x === 2 && y === 11) return 40;
    if (x === 3 && y === 11) return 41;
    if (x === 6 && y === 11) return 44;
    // Whiteboard
    if (x === 15 && y === 2) return 54;
    // Door
    if (x === 9 && y === 13) return 60;
  }
  
  // Park furniture
  if (x >= 20 && y < 15) {
    // Park boundary
    if (y === 0 || y === 14) return 70; // Fence
    if (x === 20 || x === 39) return 71; // Fence vertical
    // Trees
    if ((x === 22 || x === 26 || x === 30 || x === 35) && y === 2) return 72;
    if ((x === 24 || x === 33 || x === 37) && y === 12) return 72;
    // Benches
    if (x === 25 && y === 5) return 73;
    if (x === 32 && y === 8) return 73;
    // Fountain
    if (x >= 27 && x <= 29 && y >= 6 && y <= 8) return 74;
    // Flowers
    if ((x === 23 || x === 31 || x === 36) && y === 4) return 75;
  }
  
  // Residential
  if (x < 20 && y >= 15) {
    // Houses
    if (x >= 2 && x <= 6 && y >= 17 && y <= 20) return 80; // House 1
    if (x >= 9 && x <= 13 && y >= 17 && y <= 20) return 80; // House 2
    if (x >= 2 && x <= 6 && y >= 23 && y <= 26) return 80; // House 3
    // Street lamps
    if ((x === 1 || x === 18) && (y === 16 || y === 23)) return 81;
    // Mailboxes
    if (x === 7 && y === 20) return 82;
    if (x === 14 && y === 20) return 82;
  }
  
  // Coffee shop
  if (x >= 20 && x < 30 && y >= 15) {
    // Walls
    if (y === 15) return 10;
    if (y === 29) return 11;
    if (x === 20) return 12;
    if (x === 29) return 13;
    // Counter
    if (x >= 23 && x <= 26 && y === 19) return 90;
    // Coffee machine
    if (x === 27 && y === 17) return 40;
    // Tables
    if ((x === 22 || x === 26) && y === 24) return 91;
    // Chairs
    if ((x === 21 || x === 23 || x === 25 || x === 27) && y === 24) return 24;
    // Door
    if (x === 24 && y === 15) return 60;
  }
  
  // Store
  if (x >= 30 && y >= 15) {
    // Walls
    if (y === 15) return 10;
    if (y === 29) return 11;
    if (x === 30) return 12;
    if (x === 39) return 13;
    // Counter
    if (x >= 33 && x <= 36 && y === 19) return 92;
    // Shelves
    if ((x === 32 || x === 37) && (y === 22 || y === 25)) return 93;
    // Door
    if (x === 34 && y === 15) return 60;
  }
  
  return -1;
}

function generateCollisionLayer(): number[][] {
  const layer: number[][] = [];
  
  for (let y = 0; y < 30; y++) {
    const row: number[] = [];
    for (let x = 0; x < 40; x++) {
      row.push(getCollision(x, y));
    }
    layer.push(row);
  }
  
  return layer;
}

function getCollision(x: number, y: number): number {
  // Office walls
  if (x < 20 && y < 15) {
    if (y === 0 || y === 14) return 1;
    if (x === 0 || x === 19) return 1;
    // Door is walkable
    if (x === 9 && y === 13) return 0;
    // Furniture collision
    if ((x === 2 || x === 6) && (y === 2 || y === 5 || y === 8)) return 1;
    if ((x === 3 || x === 7) && (y === 2 || y === 5 || y === 8)) return 1;
    if ((x === 10 || x === 11) && (y === 9 || y === 10)) return 1;
    if (x === 2 && y === 11) return 1;
    if (x === 3 && y === 11) return 1;
    if (x === 15 && y === 2) return 1;
  }
  
  // Park
  if (x >= 20 && y < 15) {
    if (y === 0 || y === 14) return 1;
    if (x === 20 || x === 39) return 1;
    // Trees
    if ((x === 22 || x === 26 || x === 30 || x === 35) && y === 2) return 1;
    if ((x === 24 || x === 33 || x === 37) && y === 12) return 1;
    // Fountain
    if (x >= 27 && x <= 29 && y >= 6 && y <= 8) return 1;
  }
  
  // Residential
  if (x < 20 && y >= 15) {
    // Houses
    if (x >= 2 && x <= 6 && y >= 17 && y <= 20) return 1;
    if (x >= 9 && x <= 13 && y >= 17 && y <= 20) return 1;
    if (x >= 2 && x <= 6 && y >= 23 && y <= 26) return 1;
    // Street lamps
    if ((x === 1 || x === 18) && (y === 16 || y === 23)) return 1;
  }
  
  // Coffee shop
  if (x >= 20 && x < 30 && y >= 15) {
    if (y === 15 && x !== 24) return 1;
    if (y === 29) return 1;
    if (x === 20 || x === 29) return 1;
    // Counter
    if (x >= 23 && x <= 26 && y === 19) return 1;
    if (x === 27 && y === 17) return 1;
    // Tables
    if ((x === 22 || x === 26) && y === 24) return 1;
  }
  
  // Store
  if (x >= 30 && y >= 15) {
    if (y === 15 && x !== 34) return 1;
    if (y === 29) return 1;
    if (x === 30 || x === 39) return 1;
    // Counter
    if (x >= 33 && x <= 36 && y === 19) return 1;
    // Shelves
    if ((x === 32 || x === 37) && (y === 22 || y === 25)) return 1;
  }
  
  return 0;
}

export type TownArea = keyof typeof TOWN_MAP.areas;
export type TownLocation = keyof typeof TOWN_MAP.locations;
