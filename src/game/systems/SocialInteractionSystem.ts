import Phaser from 'phaser';
import { PICO8_COLORS } from '../tiles/palette';
import { AgentSprite } from '../sprites';
import { TILE_SIZE } from '../tiles/tileset-generator';

// Types for social interactions
interface Moment {
  id: string;
  agent_id: string;
  content: string;
  emotion: string | null;
  likes: number;
  created_at: string;
  comments: Comment[];
}

interface Comment {
  id: string;
  moment_id: string;
  author_type: string;
  author_id: string;
  content: string;
  created_at: string;
}

interface ActiveInteraction {
  agents: [string, string];
  startTime: number;
  dialogues: string[];
  currentDialogueIndex: number;
  bubbles: Phaser.GameObjects.Container[];
  areaKey?: string;
}

// Bubble queue system: limit bubbles per area
interface BubbleQueueEntry {
  interactionKey: string;
  areaKey: string;
  priority: number;
}

interface LikeEffect {
  x: number;
  y: number;
  startTime: number;
  container: Phaser.GameObjects.Container;
}

export interface SocialInteractionConfig {
  interactionDistance: number;  // Tile distance to trigger interaction
  dialogueDuration: number;     // Ms per dialogue bubble
  pollInterval: number;         // Ms between API polls
  maxDialogues: number;         // Max dialogues per interaction
  maxBubblesPerArea: number;    // Max simultaneous bubbles per area
}

const DEFAULT_CONFIG: SocialInteractionConfig = {
  interactionDistance: 2,
  dialogueDuration: 3000,
  pollInterval: 10000,
  maxDialogues: 4,
  maxBubblesPerArea: 3,
};

export class SocialInteractionSystem {
  private scene: Phaser.Scene;
  private config: SocialInteractionConfig;
  private agents: Map<string, AgentSprite> = new Map();
  private moments: Moment[] = [];
  private activeInteractions: Map<string, ActiveInteraction> = new Map();
  private likeEffects: LikeEffect[] = [];
  private pollTimer: number | null = null;
  private lastLikeCount: Map<string, number> = new Map();
  private agentInInteraction: Set<string> = new Set();
  private bubbleQueue: BubbleQueueEntry[] = [];
  private activeBubblesPerArea: Map<string, number> = new Map();

  constructor(scene: Phaser.Scene, config: Partial<SocialInteractionConfig> = {}) {
    this.scene = scene;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // Determine area key from pixel position
  private getAreaFromPosition(x: number, y: number): string {
    const tileX = Math.floor(x / TILE_SIZE);
    const tileY = Math.floor(y / TILE_SIZE);
    // Simple area detection based on tile coordinates
    if (tileX >= 2 && tileX <= 13 && tileY >= 15 && tileY <= 24) return 'office';
    if (tileX >= 15 && tileX <= 38 && tileY >= 1 && tileY <= 12) return 'park';
    if (tileX >= 16 && tileX <= 23 && tileY >= 15 && tileY <= 22) return 'plaza';
    if (tileX >= 28 && tileX <= 37 && tileY >= 15 && tileY <= 23) return 'coffeeShop';
    if (tileX >= 41 && tileX <= 50 && tileY >= 15 && tileY <= 23) return 'store';
    if (tileX >= 4 && tileX <= 51 && tileY >= 27 && tileY <= 34) return 'residential';
    return 'outdoor';
  }

  // Check if area can accept more bubbles
  private canShowBubbleInArea(areaKey: string): boolean {
    const count = this.activeBubblesPerArea.get(areaKey) ?? 0;
    return count < this.config.maxBubblesPerArea;
  }

  // Increment bubble count for area
  private incrementAreaBubbles(areaKey: string): void {
    const count = this.activeBubblesPerArea.get(areaKey) ?? 0;
    this.activeBubblesPerArea.set(areaKey, count + 1);
  }

  // Decrement bubble count for area
  private decrementAreaBubbles(areaKey: string): void {
    const count = this.activeBubblesPerArea.get(areaKey) ?? 0;
    this.activeBubblesPerArea.set(areaKey, Math.max(0, count - 1));
  }

  start(): void {
    this.fetchMoments();
    this.pollTimer = window.setInterval(() => {
      this.fetchMoments();
    }, this.config.pollInterval);
  }

  registerAgent(agentId: string, sprite: AgentSprite): void {
    this.agents.set(agentId, sprite);
  }

  unregisterAgent(agentId: string): void {
    this.agents.delete(agentId);
    // Clean up any active interactions involving this agent
    for (const [key, interaction] of this.activeInteractions) {
      if (interaction.agents.includes(agentId)) {
        this.endInteraction(key);
      }
    }
  }

  private async fetchMoments(): Promise<void> {
    try {
      const res = await fetch('/api/moments?limit=20');
      if (!res.ok) return;
      const data: Moment[] = await res.json();
      
      // Check for new likes
      for (const moment of data) {
        const prevLikes = this.lastLikeCount.get(moment.id) ?? moment.likes;
        if (moment.likes > prevLikes) {
          // New like detected - show effect
          const agent = this.agents.get(moment.agent_id);
          if (agent) {
            this.showLikeEffect(agent.x, agent.y - 40);
          }
        }
        this.lastLikeCount.set(moment.id, moment.likes);
      }
      
      this.moments = data;
    } catch (err) {
      console.error('Failed to fetch moments:', err);
    }
  }

  update(): void {
    this.checkProximity();
    this.updateInteractions();
    this.updateLikeEffects();
  }

  private checkProximity(): void {
    const agentList = Array.from(this.agents.entries());
    
    for (let i = 0; i < agentList.length; i++) {
      for (let j = i + 1; j < agentList.length; j++) {
        const [id1, sprite1] = agentList[i];
        const [id2, sprite2] = agentList[j];
        
        const dx = Math.abs(sprite1.x - sprite2.x) / TILE_SIZE;
        const dy = Math.abs(sprite1.y - sprite2.y) / TILE_SIZE;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        const interactionKey = this.getInteractionKey(id1, id2);
        
        if (distance <= this.config.interactionDistance) {
          if (!this.activeInteractions.has(interactionKey)
            && !this.agentInInteraction.has(id1)
            && !this.agentInInteraction.has(id2)
            && this.activeInteractions.size < 3) {
            this.startInteraction(id1, id2, sprite1, sprite2);
          }
        } else {
          if (this.activeInteractions.has(interactionKey)) {
            this.endInteraction(interactionKey);
          }
        }
      }
    }
  }

  private getInteractionKey(id1: string, id2: string): string {
    return [id1, id2].sort().join(':');
  }

  private startInteraction(
    id1: string,
    id2: string,
    sprite1: AgentSprite,
    sprite2: AgentSprite
  ): void {
    const key = this.getInteractionKey(id1, id2);
    const areaKey = this.getAreaFromPosition(sprite1.x, sprite1.y);
    
    // Get dialogues from moments and comments
    const dialogues = this.getDialoguesForAgents(id1, id2);
    if (dialogues.length === 0) {
      // Generate default greeting
      dialogues.push('👋 Hey!', '👋 Hi there!');
    }

    // Make agents face each other
    if (sprite1.x < sprite2.x) {
      sprite1.walk('right');
      sprite2.walk('left');
    } else {
      sprite1.walk('left');
      sprite2.walk('right');
    }
    
    // Stop walking animation after a moment
    this.scene.time.delayedCall(200, () => {
      sprite1.idle();
      sprite2.idle();
    });

    const interaction: ActiveInteraction = {
      agents: [id1, id2],
      startTime: Date.now(),
      dialogues,
      currentDialogueIndex: 0,
      bubbles: [],
      areaKey,
    };

    this.activeInteractions.set(key, interaction);
    this.agentInInteraction.add(id1);
    this.agentInInteraction.add(id2);
    
    // Check if we can show bubble immediately or need to queue
    if (this.canShowBubbleInArea(areaKey)) {
      this.incrementAreaBubbles(areaKey);
      this.showDialogueBubble(interaction, sprite1, sprite2);
    } else {
      // Add to queue with priority based on start time
      this.bubbleQueue.push({
        interactionKey: key,
        areaKey,
        priority: Date.now(),
      });
    }
  }

  private getDialoguesForAgents(id1: string, id2: string): string[] {
    const dialogues: string[] = [];
    
    // Find moments from either agent
    const relevantMoments = this.moments.filter(
      m => m.agent_id === id1 || m.agent_id === id2
    ).slice(0, 2);

    for (const moment of relevantMoments) {
      // Add moment content as dialogue
      const shortContent = moment.content.length > 50 
        ? moment.content.substring(0, 47) + '...'
        : moment.content;
      dialogues.push(shortContent);

      // Add comments as responses
      const otherAgentId = moment.agent_id === id1 ? id2 : id1;
      const agentComments = moment.comments.filter(
        c => c.author_type === 'agent' && c.author_id === otherAgentId
      );
      
      for (const comment of agentComments.slice(0, 1)) {
        const shortComment = comment.content.length > 50
          ? comment.content.substring(0, 47) + '...'
          : comment.content;
        dialogues.push(shortComment);
      }
    }

    return dialogues.slice(0, this.config.maxDialogues);
  }

  private showDialogueBubble(
    interaction: ActiveInteraction,
    sprite1: AgentSprite,
    sprite2: AgentSprite
  ): void {
    const idx = interaction.currentDialogueIndex;
    if (idx >= interaction.dialogues.length) {
      // Restart dialogue loop
      interaction.currentDialogueIndex = 0;
      this.showDialogueBubble(interaction, sprite1, sprite2);
      return;
    }

    // Clear previous bubbles
    for (const bubble of interaction.bubbles) {
      bubble.destroy();
    }
    interaction.bubbles = [];

    const text = interaction.dialogues[idx];
    const isFirstSpeaker = idx % 2 === 0;
    const speaker = isFirstSpeaker ? sprite1 : sprite2;

    const bubble = this.createDialogueBubble(speaker.x, speaker.y - 50, text);
    interaction.bubbles.push(bubble);

    // Schedule next dialogue
    this.scene.time.delayedCall(this.config.dialogueDuration, () => {
      if (this.activeInteractions.has(this.getInteractionKey(interaction.agents[0], interaction.agents[1]))) {
        interaction.currentDialogueIndex++;
        this.showDialogueBubble(interaction, sprite1, sprite2);
      }
    });
  }

  private createDialogueBubble(x: number, y: number, text: string): Phaser.GameObjects.Container {
    const container = this.scene.add.container(x, y);
    container.setDepth(1000);

    // Calculate bubble size based on text
    const maxWidth = 120;
    const padding = 8;
    const lineHeight = 12;
    
    // Word wrap text
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';
    
    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      if (testLine.length * 6 > maxWidth - padding * 2) {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);

    const bubbleWidth = Math.min(maxWidth, Math.max(...lines.map(l => l.length * 6)) + padding * 2);
    const bubbleHeight = lines.length * lineHeight + padding * 2;

    // Draw bubble background
    const graphics = this.scene.add.graphics();
    graphics.fillStyle(PICO8_COLORS.white);
    graphics.fillRoundedRect(-bubbleWidth / 2, -bubbleHeight, bubbleWidth, bubbleHeight, 4);
    
    // Draw bubble tail
    graphics.fillTriangle(
      -4, 0,
      4, 0,
      0, 8
    );
    
    // Draw border
    graphics.lineStyle(1, PICO8_COLORS.darkGray);
    graphics.strokeRoundedRect(-bubbleWidth / 2, -bubbleHeight, bubbleWidth, bubbleHeight, 4);
    
    container.add(graphics);

    // Add text
    const textObj = this.scene.add.text(0, -bubbleHeight / 2 - padding / 2, lines.join('\n'), {
      fontSize: '10px',
      color: '#1d2b53',
      fontFamily: 'monospace',
      align: 'center',
    });
    textObj.setOrigin(0.5, 0.5);
    container.add(textObj);

    // Animate bubble appearance
    container.setScale(0);
    this.scene.tweens.add({
      targets: container,
      scaleX: 1,
      scaleY: 1,
      duration: 150,
      ease: 'Back.easeOut',
    });

    return container;
  }

  private endInteraction(key: string): void {
    const interaction = this.activeInteractions.get(key);
    if (!interaction) return;

    // Clean up bubbles
    for (const bubble of interaction.bubbles) {
      this.scene.tweens.add({
        targets: bubble,
        scaleX: 0,
        scaleY: 0,
        duration: 100,
        onComplete: () => bubble.destroy(),
      });
    }

    if (interaction) {
      this.agentInInteraction.delete(interaction.agents[0]);
      this.agentInInteraction.delete(interaction.agents[1]);
      
      // Decrement area bubble count if this interaction had active bubbles
      if (interaction.areaKey && interaction.bubbles.length > 0) {
        this.decrementAreaBubbles(interaction.areaKey);
        // Process queue for this area
        this.processQueueForArea(interaction.areaKey);
      }
    }
    this.activeInteractions.delete(key);
  }

  // Process queued interactions for a specific area
  private processQueueForArea(areaKey: string): void {
    const queuedIndex = this.bubbleQueue.findIndex(q => q.areaKey === areaKey);
    if (queuedIndex === -1) return;
    
    if (!this.canShowBubbleInArea(areaKey)) return;
    
    const queued = this.bubbleQueue.splice(queuedIndex, 1)[0];
    const interaction = this.activeInteractions.get(queued.interactionKey);
    if (!interaction) return;
    
    const sprite1 = this.agents.get(interaction.agents[0]);
    const sprite2 = this.agents.get(interaction.agents[1]);
    if (!sprite1 || !sprite2) return;
    
    this.incrementAreaBubbles(areaKey);
    this.showDialogueBubble(interaction, sprite1, sprite2);
  }

  private updateInteractions(): void {
    // Interactions are updated via scheduled callbacks
  }

  showLikeEffect(x: number, y: number): void {
    const container = this.scene.add.container(x, y);
    container.setDepth(1001);

    // Create heart emoji
    const heart = this.scene.add.text(0, 0, '❤️', {
      fontSize: '20px',
    });
    heart.setOrigin(0.5, 0.5);
    container.add(heart);

    // Create +1 text
    const plusOne = this.scene.add.text(12, -8, '+1', {
      fontSize: '12px',
      color: '#ff004d',
      fontFamily: 'monospace',
      fontStyle: 'bold',
    });
    plusOne.setOrigin(0, 0.5);
    container.add(plusOne);

    const effect: LikeEffect = {
      x,
      y,
      startTime: Date.now(),
      container,
    };
    this.likeEffects.push(effect);

    // Animate
    this.scene.tweens.add({
      targets: container,
      y: y - 40,
      alpha: 0,
      duration: 1500,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        container.destroy();
        const idx = this.likeEffects.indexOf(effect);
        if (idx >= 0) this.likeEffects.splice(idx, 1);
      },
    });

    // Scale bounce
    this.scene.tweens.add({
      targets: container,
      scaleX: 1.3,
      scaleY: 1.3,
      duration: 200,
      yoyo: true,
      ease: 'Bounce.easeOut',
    });
  }

  private updateLikeEffects(): void {
    // Effects are updated via tweens
  }

  // Public method to manually trigger like effect (for testing)
  triggerLikeEffect(agentId: string): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      this.showLikeEffect(agent.x, agent.y - 40);
    }
  }

  destroy(): void {
    if (this.pollTimer !== null) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }

    // Clean up all interactions
    for (const key of this.activeInteractions.keys()) {
      this.endInteraction(key);
    }

    // Clean up like effects
    for (const effect of this.likeEffects) {
      effect.container.destroy();
    }
    this.likeEffects = [];
  }
}
