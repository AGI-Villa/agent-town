import EasyStar from 'easystarjs';

export interface PathNode {
  x: number;
  y: number;
}

export class PathfindingManager {
  private easystar: EasyStar.js;
  private grid: number[][] = [];
  private gridWidth: number = 0;
  private gridHeight: number = 0;
  private occupiedTiles: Map<string, string> = new Map(); // tileKey -> agentId

  constructor() {
    this.easystar = new EasyStar.js();
    this.easystar.setAcceptableTiles([0]); // 0 = walkable
    this.easystar.enableDiagonals();
    this.easystar.disableCornerCutting();
  }

  // Initialize with collision layer from map
  setGrid(collisionLayer: number[][]): void {
    this.gridHeight = collisionLayer.length;
    this.gridWidth = collisionLayer[0]?.length || 0;
    
    // Convert collision layer: 0 = walkable, 1 = blocked
    // EasyStar expects: acceptable tiles are walkable
    this.grid = collisionLayer.map(row => 
      row.map(cell => cell === 0 ? 0 : 1)
    );
    
    this.easystar.setGrid(this.grid);
  }

  // Find path from start to end
  findPath(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    callback: (path: PathNode[] | null) => void
  ): void {
    // Validate coordinates
    if (!this.isValidTile(startX, startY) || !this.isValidTile(endX, endY)) {
      callback(null);
      return;
    }

    // Check if destination is walkable
    if (this.grid[endY]?.[endX] !== 0) {
      callback(null);
      return;
    }

    this.easystar.findPath(startX, startY, endX, endY, (path) => {
      callback(path);
    });
    
    this.easystar.calculate();
  }

  // Async version of findPath
  findPathAsync(
    startX: number,
    startY: number,
    endX: number,
    endY: number
  ): Promise<PathNode[] | null> {
    return new Promise((resolve) => {
      this.findPath(startX, startY, endX, endY, resolve);
    });
  }

  // Check if tile is valid
  private isValidTile(x: number, y: number): boolean {
    return x >= 0 && x < this.gridWidth && y >= 0 && y < this.gridHeight;
  }

  // Check if tile is walkable
  isWalkable(x: number, y: number): boolean {
    if (!this.isValidTile(x, y)) return false;
    return this.grid[y][x] === 0;
  }

  // Occupy a tile (for collision avoidance)
  occupyTile(x: number, y: number, agentId: string): void {
    const key = `${x},${y}`;
    this.occupiedTiles.set(key, agentId);
  }

  // Release a tile
  releaseTile(x: number, y: number): void {
    const key = `${x},${y}`;
    this.occupiedTiles.delete(key);
  }

  // Check if tile is occupied by another agent
  isTileOccupied(x: number, y: number, excludeAgentId?: string): boolean {
    const key = `${x},${y}`;
    const occupant = this.occupiedTiles.get(key);
    if (!occupant) return false;
    if (excludeAgentId && occupant === excludeAgentId) return false;
    return true;
  }

  // Get occupant of a tile
  getTileOccupant(x: number, y: number): string | undefined {
    return this.occupiedTiles.get(`${x},${y}`);
  }

  // Find nearest walkable tile to target
  findNearestWalkable(targetX: number, targetY: number, excludeAgentId?: string): PathNode | null {
    if (this.isWalkable(targetX, targetY) && !this.isTileOccupied(targetX, targetY, excludeAgentId)) {
      return { x: targetX, y: targetY };
    }

    // Spiral search for nearest walkable tile
    const maxRadius = Math.max(this.gridWidth, this.gridHeight);
    for (let radius = 1; radius < maxRadius; radius++) {
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
          if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;
          
          const x = targetX + dx;
          const y = targetY + dy;
          
          if (this.isWalkable(x, y) && !this.isTileOccupied(x, y, excludeAgentId)) {
            return { x, y };
          }
        }
      }
    }

    return null;
  }

  // Get grid dimensions
  getGridSize(): { width: number; height: number } {
    return { width: this.gridWidth, height: this.gridHeight };
  }
}
