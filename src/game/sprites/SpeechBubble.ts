import Phaser from 'phaser';
import { PICO8_COLORS } from '../tiles/palette';

export interface SpeechBubbleConfig {
  maxWidth?: number;
  maxChars?: number;
  duration?: number;
  fontSize?: number;
}

const DEFAULT_CONFIG: SpeechBubbleConfig = {
  maxWidth: 120,
  maxChars: 50,
  duration: 3000,
  fontSize: 8,
};

export class SpeechBubble extends Phaser.GameObjects.Container {
  private bubble: Phaser.GameObjects.Graphics;
  private text: Phaser.GameObjects.Text;
  private config: SpeechBubbleConfig;
  private hideTimer?: Phaser.Time.TimerEvent;

  constructor(scene: Phaser.Scene, x: number, y: number, config: SpeechBubbleConfig = {}) {
    super(scene, x, y);
    this.config = { ...DEFAULT_CONFIG, ...config };

    this.bubble = scene.add.graphics();
    this.text = scene.add.text(0, 0, '', {
      fontSize: `${this.config.fontSize}px`,
      color: '#000000',
      fontFamily: 'monospace',
      wordWrap: { width: this.config.maxWidth! - 16 },
      align: 'center',
    });
    this.text.setOrigin(0.5, 0.5);

    this.add(this.bubble);
    this.add(this.text);

    this.setVisible(false);
    this.setDepth(2000);

    scene.add.existing(this);
  }

  show(message: string, duration?: number): void {
    // Truncate message if too long
    const truncated = message.length > this.config.maxChars!
      ? message.slice(0, this.config.maxChars! - 3) + '...'
      : message;

    this.text.setText(truncated);

    // Calculate bubble size
    const padding = 8;
    const textBounds = this.text.getBounds();
    const bubbleWidth = Math.min(textBounds.width + padding * 2, this.config.maxWidth!);
    const bubbleHeight = textBounds.height + padding * 2;

    // Draw bubble
    this.bubble.clear();
    
    // Shadow
    this.bubble.fillStyle(0x000000, 0.3);
    this.bubble.fillRoundedRect(-bubbleWidth / 2 + 2, -bubbleHeight + 2, bubbleWidth, bubbleHeight, 4);
    
    // Main bubble
    this.bubble.fillStyle(PICO8_COLORS.white);
    this.bubble.fillRoundedRect(-bubbleWidth / 2, -bubbleHeight, bubbleWidth, bubbleHeight, 4);
    
    // Border
    this.bubble.lineStyle(1, PICO8_COLORS.darkGray);
    this.bubble.strokeRoundedRect(-bubbleWidth / 2, -bubbleHeight, bubbleWidth, bubbleHeight, 4);
    
    // Tail (pointing down)
    this.bubble.fillStyle(PICO8_COLORS.white);
    this.bubble.fillTriangle(-4, 0, 4, 0, 0, 8);
    this.bubble.lineStyle(1, PICO8_COLORS.darkGray);
    this.bubble.lineBetween(-4, 0, 0, 8);
    this.bubble.lineBetween(4, 0, 0, 8);

    // Position text
    this.text.setPosition(0, -bubbleHeight / 2);

    this.setVisible(true);

    // Auto-hide
    if (this.hideTimer) {
      this.hideTimer.destroy();
    }
    this.hideTimer = this.scene.time.delayedCall(duration ?? this.config.duration!, () => {
      this.hide();
    });
  }

  hide(): void {
    this.setVisible(false);
    if (this.hideTimer) {
      this.hideTimer.destroy();
      this.hideTimer = undefined;
    }
  }

  destroy(fromScene?: boolean): void {
    if (this.hideTimer) {
      this.hideTimer.destroy();
    }
    super.destroy(fromScene);
  }
}
