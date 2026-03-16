import Phaser from 'phaser';

export interface TouchInputConfig {
  dragThreshold: number;        // Min distance to start drag
  pinchZoomEnabled: boolean;    // Enable pinch-to-zoom
  minZoom: number;              // Minimum zoom level
  maxZoom: number;              // Maximum zoom level
  zoomSensitivity: number;      // Zoom speed multiplier
  doubleTapZoom: boolean;       // Enable double-tap to zoom
  doubleTapDelay: number;       // Max ms between taps for double-tap
  tapSelectEnabled: boolean;    // Enable tap to select agents
  longPressDelay: number;       // Ms to trigger long press
}

const DEFAULT_CONFIG: TouchInputConfig = {
  dragThreshold: 10,
  pinchZoomEnabled: true,
  minZoom: 0.5,
  maxZoom: 4,
  zoomSensitivity: 0.01,
  doubleTapZoom: true,
  doubleTapDelay: 300,
  tapSelectEnabled: true,
  longPressDelay: 500,
};

export class TouchInputManager {
  private scene: Phaser.Scene;
  private config: TouchInputConfig;
  private isDragging: boolean = false;
  private isPinching: boolean = false;
  private dragStartX: number = 0;
  private dragStartY: number = 0;
  private lastPinchDistance: number = 0;
  private lastTapTime: number = 0;
  private lastTapX: number = 0;
  private lastTapY: number = 0;
  private initialScrollX: number = 0;
  private initialScrollY: number = 0;
  private pinchCenterX: number = 0;
  private pinchCenterY: number = 0;
  private initialPinchZoom: number = 1;
  private longPressTimer: ReturnType<typeof setTimeout> | null = null;
  private pointerDownTime: number = 0;

  constructor(scene: Phaser.Scene, config: Partial<TouchInputConfig> = {}) {
    this.scene = scene;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  create(): void {
    const input = this.scene.input;

    // Enable multi-touch
    input.addPointer(1); // Add second pointer for pinch

    // Pointer down
    input.on('pointerdown', this.onPointerDown, this);

    // Pointer move
    input.on('pointermove', this.onPointerMove, this);

    // Pointer up
    input.on('pointerup', this.onPointerUp, this);

    // Wheel zoom (for desktop)
    input.on('wheel', this.onWheel, this);
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    const now = Date.now();
    this.pointerDownTime = now;
    
    // Clear any existing long press timer
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
    
    // Check for double tap
    if (this.config.doubleTapZoom && !pointer.rightButtonDown()) {
      const dx = pointer.x - this.lastTapX;
      const dy = pointer.y - this.lastTapY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (now - this.lastTapTime < this.config.doubleTapDelay && distance < 50) {
        this.handleDoubleTap(pointer);
        this.lastTapTime = 0;
        return;
      }
      
      this.lastTapTime = now;
      this.lastTapX = pointer.x;
      this.lastTapY = pointer.y;
    }

    // Start drag
    this.dragStartX = pointer.x;
    this.dragStartY = pointer.y;
    this.initialScrollX = this.scene.cameras.main.scrollX;
    this.initialScrollY = this.scene.cameras.main.scrollY;
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    const input = this.scene.input;
    const pointer1 = input.pointer1;
    const pointer2 = input.pointer2;

    // Clear long press timer on move
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }

    // Check for pinch gesture
    if (this.config.pinchZoomEnabled && pointer1.isDown && pointer2.isDown) {
      this.handlePinch(pointer1, pointer2);
      return;
    }

    // Handle drag
    if (pointer.isDown && !this.isPinching) {
      const dx = pointer.x - this.dragStartX;
      const dy = pointer.y - this.dragStartY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > this.config.dragThreshold || this.isDragging) {
        this.isDragging = true;
        const cam = this.scene.cameras.main;
        cam.scrollX = this.initialScrollX - dx / cam.zoom;
        cam.scrollY = this.initialScrollY - dy / cam.zoom;
      }
    }
  }

  private onPointerUp(pointer: Phaser.Input.Pointer): void {
    // Clear long press timer
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
    
    // Check for tap (short press without drag)
    const now = Date.now();
    const pressDuration = now - this.pointerDownTime;
    const dx = pointer.x - this.dragStartX;
    const dy = pointer.y - this.dragStartY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // If it was a quick tap without much movement, it's a tap gesture
    // The actual tap handling is done by Phaser's built-in pointer events on game objects
    // This just ensures we don't interfere with tap detection
    
    this.isDragging = false;
    this.isPinching = false;
    this.lastPinchDistance = 0;
  }

  private handlePinch(pointer1: Phaser.Input.Pointer, pointer2: Phaser.Input.Pointer): void {
    const dx = pointer2.x - pointer1.x;
    const dy = pointer2.y - pointer1.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Calculate pinch center in screen coordinates
    const centerX = (pointer1.x + pointer2.x) / 2;
    const centerY = (pointer1.y + pointer2.y) / 2;

    if (this.lastPinchDistance > 0) {
      const delta = distance - this.lastPinchDistance;
      const zoomDelta = delta * this.config.zoomSensitivity;
      this.applyZoom(zoomDelta, centerX, centerY);
    } else {
      // First frame of pinch - store initial state
      this.pinchCenterX = centerX;
      this.pinchCenterY = centerY;
      this.initialPinchZoom = this.scene.cameras.main.zoom;
    }

    this.lastPinchDistance = distance;
    this.isPinching = true;
  }

  private handleDoubleTap(pointer: Phaser.Input.Pointer): void {
    const cam = this.scene.cameras.main;
    
    // Calculate min zoom to fill viewport
    const mapWidth = (this.scene as any).mapWidth || 1920;
    const mapHeight = (this.scene as any).mapHeight || 1280;
    const minZoomX = cam.width / mapWidth;
    const minZoomY = cam.height / mapHeight;
    const minZoom = Math.max(minZoomX, minZoomY, this.config.minZoom);
    
    // Toggle between zoomed out and zoomed in
    const targetZoom = cam.zoom < 1.5 ? Math.min(2.5, this.config.maxZoom) : minZoom;
    
    // Convert pointer position to world coordinates before zoom
    const worldX = cam.scrollX + pointer.x / cam.zoom;
    const worldY = cam.scrollY + pointer.y / cam.zoom;
    
    // Animate zoom
    this.scene.tweens.add({
      targets: cam,
      zoom: targetZoom,
      duration: 250,
      ease: 'Cubic.easeOut',
      onUpdate: () => {
        // Keep the tapped point under the pointer during zoom
        if (targetZoom > cam.zoom) {
          cam.scrollX = worldX - pointer.x / cam.zoom;
          cam.scrollY = worldY - pointer.y / cam.zoom;
        }
      },
    });
  }

  private onWheel(
    pointer: Phaser.Input.Pointer,
    _gameObjects: Phaser.GameObjects.GameObject[],
    _deltaX: number,
    deltaY: number
  ): void {
    const zoomDelta = -deltaY * 0.001;
    this.applyZoom(zoomDelta, pointer.x, pointer.y);
  }

  private applyZoom(delta: number, centerX: number, centerY: number): void {
    const cam = this.scene.cameras.main;
    
    // Calculate min zoom to fill viewport (no black edges)
    const mapWidth = (this.scene as any).mapWidth || 1920;
    const mapHeight = (this.scene as any).mapHeight || 1280;
    const minZoomX = cam.width / mapWidth;
    const minZoomY = cam.height / mapHeight;
    const minZoom = Math.max(minZoomX, minZoomY, this.config.minZoom);
    
    const newZoom = Phaser.Math.Clamp(
      cam.zoom + delta,
      minZoom,
      this.config.maxZoom
    );

    if (newZoom !== cam.zoom) {
      // Zoom towards pointer position
      const worldX = cam.scrollX + centerX / cam.zoom;
      const worldY = cam.scrollY + centerY / cam.zoom;
      
      cam.zoom = newZoom;
      
      // Adjust scroll to keep pointer position stable
      cam.scrollX = worldX - centerX / newZoom;
      cam.scrollY = worldY - centerY / newZoom;
    }
  }

  setZoom(zoom: number): void {
    const cam = this.scene.cameras.main;
    cam.zoom = Phaser.Math.Clamp(zoom, this.config.minZoom, this.config.maxZoom);
  }

  getZoom(): number {
    return this.scene.cameras.main.zoom;
  }

  destroy(): void {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
    const input = this.scene.input;
    input.off('pointerdown', this.onPointerDown, this);
    input.off('pointermove', this.onPointerMove, this);
    input.off('pointerup', this.onPointerUp, this);
    input.off('wheel', this.onWheel, this);
  }
}
