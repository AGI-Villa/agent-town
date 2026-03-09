import type { TownArea } from '../maps/town-map';

export interface ScheduleBlock {
  startHour: number;
  endHour: number;
  location: TownArea;
  activity: 'work' | 'lunch' | 'leisure' | 'sleep' | 'commute';
}

export interface AgentSchedule {
  name: string;
  blocks: ScheduleBlock[];
}

// Default schedule for most agents
export const DEFAULT_SCHEDULE: AgentSchedule = {
  name: 'default',
  blocks: [
    { startHour: 7, endHour: 9, location: 'residential', activity: 'commute' },
    { startHour: 9, endHour: 12, location: 'office', activity: 'work' },
    { startHour: 12, endHour: 13, location: 'plaza', activity: 'lunch' },
    { startHour: 13, endHour: 18, location: 'office', activity: 'work' },
    { startHour: 18, endHour: 20, location: 'park', activity: 'leisure' },
    { startHour: 20, endHour: 23, location: 'residential', activity: 'leisure' },
    { startHour: 23, endHour: 7, location: 'residential', activity: 'sleep' },
  ],
};

// Early bird schedule
export const EARLY_BIRD_SCHEDULE: AgentSchedule = {
  name: 'early_bird',
  blocks: [
    { startHour: 5, endHour: 6, location: 'park', activity: 'leisure' },
    { startHour: 6, endHour: 7, location: 'coffeeShop', activity: 'commute' },
    { startHour: 7, endHour: 12, location: 'office', activity: 'work' },
    { startHour: 12, endHour: 13, location: 'coffeeShop', activity: 'lunch' },
    { startHour: 13, endHour: 16, location: 'office', activity: 'work' },
    { startHour: 16, endHour: 18, location: 'plaza', activity: 'leisure' },
    { startHour: 18, endHour: 21, location: 'residential', activity: 'leisure' },
    { startHour: 21, endHour: 5, location: 'residential', activity: 'sleep' },
  ],
};

// Night owl schedule
export const NIGHT_OWL_SCHEDULE: AgentSchedule = {
  name: 'night_owl',
  blocks: [
    { startHour: 10, endHour: 11, location: 'coffeeShop', activity: 'commute' },
    { startHour: 11, endHour: 14, location: 'office', activity: 'work' },
    { startHour: 14, endHour: 15, location: 'coffeeShop', activity: 'lunch' },
    { startHour: 15, endHour: 20, location: 'office', activity: 'work' },
    { startHour: 20, endHour: 22, location: 'store', activity: 'leisure' },
    { startHour: 22, endHour: 2, location: 'residential', activity: 'leisure' },
    { startHour: 2, endHour: 10, location: 'residential', activity: 'sleep' },
  ],
};

// Remote worker — mostly at home/coffee shop
export const REMOTE_WORKER_SCHEDULE: AgentSchedule = {
  name: 'remote_worker',
  blocks: [
    { startHour: 8, endHour: 10, location: 'coffeeShop', activity: 'commute' },
    { startHour: 10, endHour: 13, location: 'residential', activity: 'work' },
    { startHour: 13, endHour: 14, location: 'coffeeShop', activity: 'lunch' },
    { startHour: 14, endHour: 18, location: 'residential', activity: 'work' },
    { startHour: 18, endHour: 20, location: 'park', activity: 'leisure' },
    { startHour: 20, endHour: 23, location: 'residential', activity: 'leisure' },
    { startHour: 23, endHour: 8, location: 'residential', activity: 'sleep' },
  ],
};

// Field agent — roams between park, store, and office
export const FIELD_AGENT_SCHEDULE: AgentSchedule = {
  name: 'field_agent',
  blocks: [
    { startHour: 8, endHour: 9, location: 'park', activity: 'leisure' },
    { startHour: 9, endHour: 11, location: 'store', activity: 'work' },
    { startHour: 11, endHour: 12, location: 'coffeeShop', activity: 'lunch' },
    { startHour: 12, endHour: 15, location: 'office', activity: 'work' },
    { startHour: 15, endHour: 17, location: 'plaza', activity: 'leisure' },
    { startHour: 17, endHour: 19, location: 'store', activity: 'work' },
    { startHour: 19, endHour: 22, location: 'residential', activity: 'leisure' },
    { startHour: 22, endHour: 8, location: 'residential', activity: 'sleep' },
  ],
};

// All available schedules
export const SCHEDULES: Record<string, AgentSchedule> = {
  default: DEFAULT_SCHEDULE,
  early_bird: EARLY_BIRD_SCHEDULE,
  night_owl: NIGHT_OWL_SCHEDULE,
  remote_worker: REMOTE_WORKER_SCHEDULE,
  field_agent: FIELD_AGENT_SCHEDULE,
};

// Get schedule block for a given hour
export function getScheduleBlockForHour(
  schedule: AgentSchedule,
  hour: number
): ScheduleBlock | null {
  for (const block of schedule.blocks) {
    // Handle overnight blocks (e.g., 23-7)
    if (block.startHour > block.endHour) {
      if (hour >= block.startHour || hour < block.endHour) {
        return block;
      }
    } else {
      if (hour >= block.startHour && hour < block.endHour) {
        return block;
      }
    }
  }
  return null;
}

// Assign schedule to agent based on agent_id hash
export function getScheduleForAgent(agentId: string): AgentSchedule {
  const hash = agentId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const scheduleKeys = Object.keys(SCHEDULES);
  const index = hash % scheduleKeys.length;
  return SCHEDULES[scheduleKeys[index]];
}
