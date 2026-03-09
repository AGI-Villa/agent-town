import Phaser from 'phaser';
import { AgentSprite } from '../sprites/AgentSprite';
import { PathfindingManager, AgentMovementController } from '../pathfinding';
import { TILE_SIZE } from '../tiles/tileset-generator';

// Meeting room seats (around meeting table at x:9-10, y:22 in office)
const MEETING_SEATS = [
  { x: 8, y: 21, facing: 'right' as const },
  { x: 8, y: 22, facing: 'right' as const },
  { x: 8, y: 23, facing: 'right' as const },
  { x: 11, y: 21, facing: 'left' as const },
  { x: 11, y: 22, facing: 'left' as const },
  { x: 11, y: 23, facing: 'left' as const },
];

// Meeting table center for facing direction
const TABLE_CENTER = { x: 9.5, y: 22 };

// Keywords that trigger meeting behavior
const MEETING_KEYWORDS = ['meeting', 'discussion', 'sync', 'standup', 'review', 'planning'];

interface MeetingParticipant {
  agentId: string;
  agent: AgentSprite;
  controller: AgentMovementController;
  originalPosition: { x: number; y: number };
  seatIndex: number;
  isSeated: boolean;
}

interface ActiveMeeting {
  id: string;
  participants: MeetingParticipant[];
  startTime: number;
  bubbleIndex: number;
  bubbleTimer: Phaser.Time.TimerEvent | null;
}

export class MeetingSystem {
  private scene: Phaser.Scene;
  private pathfinder: PathfindingManager;
  private agents: Map<string, { agent: AgentSprite; controller: AgentMovementController }> = new Map();
  private activeMeetings: Map<string, ActiveMeeting> = new Map();
  private seatOccupancy: boolean[] = new Array(MEETING_SEATS.length).fill(false);
  private discussionBubbles: Phaser.GameObjects.Container[] = [];

  constructor(scene: Phaser.Scene, pathfinder: PathfindingManager) {
    this.scene = scene;
    this.pathfinder = pathfinder;
  }

  registerAgent(agentId: string, agent: AgentSprite, controller: AgentMovementController): void {
    this.agents.set(agentId, { agent, controller });
  }

  unregisterAgent(agentId: string): void {
    // Remove from any active meetings
    for (const [meetingId, meeting] of this.activeMeetings) {
      const participantIndex = meeting.participants.findIndex(p => p.agentId === agentId);
      if (participantIndex !== -1) {
        const participant = meeting.participants[participantIndex];
        this.seatOccupancy[participant.seatIndex] = false;
        meeting.participants.splice(participantIndex, 1);
        
        if (meeting.participants.length === 0) {
          this.endMeeting(meetingId);
        }
      }
    }
    this.agents.delete(agentId);
  }

  // Check if an event indicates a meeting
  isMeetingEvent(eventType: string | null, payload?: Record<string, unknown>): boolean {
    if (!eventType) return false;
    
    const eventLower = eventType.toLowerCase();
    if (MEETING_KEYWORDS.some(keyword => eventLower.includes(keyword))) {
      return true;
    }
    
    // Check payload for session-related meeting indicators
    if (payload) {
      const payloadStr = JSON.stringify(payload).toLowerCase();
      if (MEETING_KEYWORDS.some(keyword => payloadStr.includes(keyword))) {
        return true;
      }
    }
    
    return false;
  }

  // Start a meeting with specified agents
  startMeeting(meetingId: string, agentIds: string[]): void {
    if (this.activeMeetings.has(meetingId)) return;
    
    const participants: MeetingParticipant[] = [];
    
    for (const agentId of agentIds) {
      const agentData = this.agents.get(agentId);
      if (!agentData) continue;
      
      // Find available seat
      const seatIndex = this.seatOccupancy.findIndex(occupied => !occupied);
      if (seatIndex === -1) break; // No more seats
      
      this.seatOccupancy[seatIndex] = true;
      
      participants.push({
        agentId,
        agent: agentData.agent,
        controller: agentData.controller,
        originalPosition: { x: agentData.agent.x, y: agentData.agent.y },
        seatIndex,
        isSeated: false,
      });
    }
    
    if (participants.length < 2) {
      // Release seats if not enough participants
      participants.forEach(p => {
        this.seatOccupancy[p.seatIndex] = false;
      });
      return;
    }
    
    const meeting: ActiveMeeting = {
      id: meetingId,
      participants,
      startTime: Date.now(),
      bubbleIndex: 0,
      bubbleTimer: null,
    };
    
    this.activeMeetings.set(meetingId, meeting);
    
    // Move participants to seats
    for (const participant of participants) {
      this.moveToSeat(participant);
    }
  }

  private moveToSeat(participant: MeetingParticipant): void {
    const seat = MEETING_SEATS[participant.seatIndex];
    const targetX = seat.x * TILE_SIZE + TILE_SIZE / 2;
    const targetY = (seat.y + 1) * TILE_SIZE;
    
    // Stop any wandering
    participant.agent.stopWandering();
    
    // Walk to seat
    const dx = targetX - participant.agent.x;
    const dy = targetY - participant.agent.y;
    
    if (Math.abs(dx) > Math.abs(dy)) {
      participant.agent.walk(dx > 0 ? 'right' : 'left');
    } else {
      participant.agent.walk(dy > 0 ? 'down' : 'up');
    }
    
    // Tween to seat position
    this.scene.tweens.add({
      targets: participant.agent,
      x: targetX,
      y: targetY,
      duration: 1000,
      ease: 'Linear',
      onUpdate: () => {
        participant.agent.updateDepth();
      },
      onComplete: () => {
        participant.isSeated = true;
        // Face towards table center
        participant.agent.faceTowards(
          TABLE_CENTER.x * TILE_SIZE,
          TABLE_CENTER.y * TILE_SIZE
        );
        participant.agent.rest();
        
        // Check if all participants are seated
        const meeting = this.findMeetingByAgent(participant.agentId);
        if (meeting && meeting.participants.every(p => p.isSeated)) {
          this.startDiscussion(meeting);
        }
      },
    });
  }

  private findMeetingByAgent(agentId: string): ActiveMeeting | undefined {
    for (const meeting of this.activeMeetings.values()) {
      if (meeting.participants.some(p => p.agentId === agentId)) {
        return meeting;
      }
    }
    return undefined;
  }

  private startDiscussion(meeting: ActiveMeeting): void {
    // Show discussion bubbles rotating between participants
    meeting.bubbleTimer = this.scene.time.addEvent({
      delay: 2000,
      callback: () => this.showNextBubble(meeting),
      loop: true,
    });
    
    // Show first bubble immediately
    this.showNextBubble(meeting);
  }

  private showNextBubble(meeting: ActiveMeeting): void {
    // Clear previous bubbles
    this.clearBubbles();
    
    if (meeting.participants.length === 0) return;
    
    const participant = meeting.participants[meeting.bubbleIndex % meeting.participants.length];
    meeting.bubbleIndex++;
    
    // Create speech bubble
    const bubble = this.createSpeechBubble(
      participant.agent.x,
      participant.agent.y - 40,
      this.getRandomDiscussionText()
    );
    this.discussionBubbles.push(bubble);
    
    // Auto-hide after 1.5s
    this.scene.time.delayedCall(1500, () => {
      if (bubble && bubble.active) {
        this.scene.tweens.add({
          targets: bubble,
          alpha: 0,
          duration: 200,
          onComplete: () => bubble.destroy(),
        });
      }
    });
  }

  private createSpeechBubble(x: number, y: number, text: string): Phaser.GameObjects.Container {
    const container = this.scene.add.container(x, y);
    container.setDepth(1000);
    
    // Background
    const bg = this.scene.add.graphics();
    bg.fillStyle(0xffffff, 0.95);
    bg.fillRoundedRect(-40, -20, 80, 30, 6);
    bg.lineStyle(2, 0x5f574f, 1);
    bg.strokeRoundedRect(-40, -20, 80, 30, 6);
    
    // Tail
    bg.fillStyle(0xffffff, 0.95);
    bg.fillTriangle(-5, 10, 5, 10, 0, 18);
    bg.lineStyle(2, 0x5f574f, 1);
    bg.lineBetween(-5, 10, 0, 18);
    bg.lineBetween(5, 10, 0, 18);
    
    container.add(bg);
    
    // Text
    const textObj = this.scene.add.text(0, -5, text, {
      fontSize: '8px',
      fontFamily: '"Press Start 2P", monospace',
      color: '#1d2b53',
      resolution: 2,
    });
    textObj.setOrigin(0.5, 0.5);
    container.add(textObj);
    
    // Animate in
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

  private getRandomDiscussionText(): string {
    const texts = [
      '💬 ...',
      '🤔 Hmm...',
      '👍 OK!',
      '📊 Data...',
      '🎯 Goal!',
      '✅ Done!',
      '❓ Why?',
      '💡 Idea!',
    ];
    return texts[Math.floor(Math.random() * texts.length)];
  }

  private clearBubbles(): void {
    for (const bubble of this.discussionBubbles) {
      if (bubble && bubble.active) {
        bubble.destroy();
      }
    }
    this.discussionBubbles = [];
  }

  // End a meeting and return agents to original positions
  endMeeting(meetingId: string): void {
    const meeting = this.activeMeetings.get(meetingId);
    if (!meeting) return;
    
    // Stop discussion bubbles
    if (meeting.bubbleTimer) {
      meeting.bubbleTimer.destroy();
    }
    this.clearBubbles();
    
    // Return participants to original positions
    for (const participant of meeting.participants) {
      this.seatOccupancy[participant.seatIndex] = false;
      this.returnToOriginalPosition(participant);
    }
    
    this.activeMeetings.delete(meetingId);
  }

  private returnToOriginalPosition(participant: MeetingParticipant): void {
    const { originalPosition, agent } = participant;
    
    const dx = originalPosition.x - agent.x;
    const dy = originalPosition.y - agent.y;
    
    if (Math.abs(dx) > Math.abs(dy)) {
      agent.walk(dx > 0 ? 'right' : 'left');
    } else {
      agent.walk(dy > 0 ? 'down' : 'up');
    }
    
    this.scene.tweens.add({
      targets: agent,
      x: originalPosition.x,
      y: originalPosition.y,
      duration: 1000,
      ease: 'Linear',
      onUpdate: () => {
        agent.updateDepth();
      },
      onComplete: () => {
        agent.idle();
        agent.startWandering();
      },
    });
  }

  // Get meeting seats for external use (e.g., map rendering)
  static getMeetingSeats(): typeof MEETING_SEATS {
    return MEETING_SEATS;
  }

  // Check if agent is in a meeting
  isAgentInMeeting(agentId: string): boolean {
    return this.findMeetingByAgent(agentId) !== undefined;
  }

  // Get active meeting count
  getActiveMeetingCount(): number {
    return this.activeMeetings.size;
  }

  update(): void {
    // Auto-end meetings after 30 seconds (for demo purposes)
    const now = Date.now();
    for (const [meetingId, meeting] of this.activeMeetings) {
      if (now - meeting.startTime > 30000) {
        this.endMeeting(meetingId);
      }
    }
  }

  destroy(): void {
    // End all meetings
    for (const meetingId of this.activeMeetings.keys()) {
      this.endMeeting(meetingId);
    }
    this.agents.clear();
  }
}
