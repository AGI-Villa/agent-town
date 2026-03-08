import Phaser from 'phaser';
import { AgentSprite, SpeechBubble, ParticleEffect, ParticleType } from '../sprites';
import { TILE_SIZE } from '../tiles/tileset-generator';

export interface SocialInteraction {
  id: string;
  fromAgentId: string;
  toAgentId: string;
  type: 'comment' | 'like' | 'mention';
  content?: string;
  timestamp: number;
}

type InteractionCallback = (interaction: SocialInteraction) => void;

export class SocialInteractionSystem {
  private scene: Phaser.Scene;
  private agents: Map<string, AgentSprite> = new Map();
  private speechBubbles: Map<string, SpeechBubble> = new Map();
  private particleEffect: ParticleEffect;
  private interactionQueue: SocialInteraction[] = [];
  private isProcessing: boolean = false;
  private listeners: Set<InteractionCallback> = new Set();
  private pollTimer: number | null = null;
  private lastFetchTime: number = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.particleEffect = new ParticleEffect(scene);
  }

  registerAgent(agentId: string, agent: AgentSprite): void {
    this.agents.set(agentId, agent);
    
    // Create speech bubble for agent
    const bubble = new SpeechBubble(this.scene, 0, 0);
    this.speechBubbles.set(agentId, bubble);
  }

  unregisterAgent(agentId: string): void {
    this.agents.delete(agentId);
    
    const bubble = this.speechBubbles.get(agentId);
    if (bubble) {
      bubble.destroy();
      this.speechBubbles.delete(agentId);
    }
  }

  // Start polling for interactions
  startPolling(intervalMs: number = 5000): void {
    if (this.pollTimer !== null) return;
    
    this.fetchInteractions();
    this.pollTimer = window.setInterval(() => {
      this.fetchInteractions();
    }, intervalMs);
  }

  stopPolling(): void {
    if (this.pollTimer !== null) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private async fetchInteractions(): Promise<void> {
    try {
      const since = this.lastFetchTime > 0 ? `?since=${this.lastFetchTime}` : '';
      const res = await fetch(`/api/interactions${since}`);
      if (!res.ok) return;
      
      const interactions: SocialInteraction[] = await res.json();
      this.lastFetchTime = Date.now();
      
      // Add to queue
      for (const interaction of interactions) {
        this.queueInteraction(interaction);
      }
    } catch (err) {
      console.error('[SocialInteractionSystem] Fetch error:', err);
    }
  }

  // Queue an interaction for display
  queueInteraction(interaction: SocialInteraction): void {
    this.interactionQueue.push(interaction);
    this.processQueue();
  }

  // Process interaction queue
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.interactionQueue.length === 0) return;
    
    this.isProcessing = true;
    
    while (this.interactionQueue.length > 0) {
      const interaction = this.interactionQueue.shift()!;
      await this.displayInteraction(interaction);
      
      // Wait between interactions
      await this.delay(1500);
    }
    
    this.isProcessing = false;
  }

  private async displayInteraction(interaction: SocialInteraction): Promise<void> {
    const fromAgent = this.agents.get(interaction.fromAgentId);
    const toAgent = this.agents.get(interaction.toAgentId);
    
    if (!fromAgent) return;

    // Notify listeners
    this.notifyListeners(interaction);

    switch (interaction.type) {
      case 'comment':
        await this.showComment(fromAgent, toAgent, interaction.content || '...');
        break;
      case 'like':
        await this.showLike(fromAgent, toAgent);
        break;
      case 'mention':
        await this.showMention(fromAgent, toAgent, interaction.content || '');
        break;
    }
  }

  private async showComment(
    fromAgent: AgentSprite,
    toAgent: AgentSprite | undefined,
    content: string
  ): Promise<void> {
    const bubble = this.speechBubbles.get(fromAgent.getAgentId());
    if (!bubble) return;

    // Position bubble above agent
    bubble.setPosition(fromAgent.x, fromAgent.y - 32);
    bubble.show(content, 4000);

    // Make agent face toward target if exists
    if (toAgent) {
      const dx = toAgent.x - fromAgent.x;
      if (Math.abs(dx) > 10) {
        fromAgent.setDirection(dx > 0 ? 'right' : 'left');
      }
    }

    // Wait for bubble to show
    await this.delay(4000);
  }

  private async showLike(
    fromAgent: AgentSprite,
    toAgent: AgentSprite | undefined
  ): Promise<void> {
    // Emit heart particles from the agent
    this.particleEffect.emitParticles(fromAgent.x, fromAgent.y - 20, 'heart', 5);

    // If target exists, also emit at target
    if (toAgent) {
      await this.delay(300);
      this.particleEffect.emitParticles(toAgent.x, toAgent.y - 20, 'heart', 3);
    }

    await this.delay(1000);
  }

  private async showMention(
    fromAgent: AgentSprite,
    toAgent: AgentSprite | undefined,
    content: string
  ): Promise<void> {
    // Show sparkle effect
    this.particleEffect.emitParticles(fromAgent.x, fromAgent.y - 20, 'sparkle', 3);

    // Show speech bubble with mention
    const bubble = this.speechBubbles.get(fromAgent.getAgentId());
    if (bubble) {
      bubble.setPosition(fromAgent.x, fromAgent.y - 32);
      bubble.show(`@${toAgent?.getAgentId() || '?'}: ${content}`, 3000);
    }

    await this.delay(3000);
  }

  // Manually trigger effects (for testing or external events)
  showHeartEffect(agentId: string): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      this.particleEffect.emitParticles(agent.x, agent.y - 20, 'heart', 5);
    }
  }

  showStarEffect(agentId: string): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      this.particleEffect.emitParticles(agent.x, agent.y - 20, 'star', 5);
    }
  }

  showSpeechBubble(agentId: string, message: string, duration?: number): void {
    const agent = this.agents.get(agentId);
    const bubble = this.speechBubbles.get(agentId);
    if (agent && bubble) {
      bubble.setPosition(agent.x, agent.y - 32);
      bubble.show(message, duration);
    }
  }

  hideSpeechBubble(agentId: string): void {
    const bubble = this.speechBubbles.get(agentId);
    if (bubble) {
      bubble.hide();
    }
  }

  // Subscribe to interactions
  onInteraction(callback: InteractionCallback): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notifyListeners(interaction: SocialInteraction): void {
    this.listeners.forEach(cb => cb(interaction));
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  update(): void {
    // Update speech bubble positions to follow agents
    for (const [agentId, bubble] of this.speechBubbles) {
      const agent = this.agents.get(agentId);
      if (agent && bubble.visible) {
        bubble.setPosition(agent.x, agent.y - 32);
      }
    }
  }

  destroy(): void {
    this.stopPolling();
    this.speechBubbles.forEach(b => b.destroy());
    this.speechBubbles.clear();
    this.particleEffect.destroy();
    this.agents.clear();
    this.listeners.clear();
  }
}
