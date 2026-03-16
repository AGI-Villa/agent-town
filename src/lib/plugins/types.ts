/**
 * Plugin System Types
 * 
 * Defines the interfaces for custom event type plugins,
 * event parsers, and notification rules.
 */

import type { Json } from "../database.types";

/**
 * Custom event type definition
 */
export interface CustomEventType {
  /** Unique identifier for this event type */
  id: string;
  /** Display name */
  name: string;
  /** Description of what this event type represents */
  description?: string;
  /** Icon to display (emoji or icon name) */
  icon: string;
  /** Category for grouping */
  category: "tool_call" | "error" | "completion" | "conversation" | "system" | "custom";
  /** Color theme for UI display */
  color?: string;
  /** Source framework (e.g., "openclaw", "autogen", "crewai") */
  framework?: string;
}

/**
 * Event parser function signature
 * Takes raw event data and returns parsed event or null if not applicable
 */
export type EventParser = (
  eventType: string,
  payload: Json | null,
  metadata?: EventParserMetadata
) => ParsedPluginEvent | null;

/**
 * Metadata passed to event parsers
 */
export interface EventParserMetadata {
  agentId: string;
  filePath?: string;
  timestamp?: string;
}

/**
 * Result of parsing an event through a plugin
 */
export interface ParsedPluginEvent {
  /** The custom event type ID */
  eventTypeId: string;
  /** Extracted summary for display */
  summary: string;
  /** Significance score (0-100) */
  significance: number;
  /** Additional structured data */
  data?: Record<string, unknown>;
  /** Whether this event should trigger a notification */
  shouldNotify?: boolean;
  /** Custom notification message (if shouldNotify is true) */
  notificationMessage?: string;
}

/**
 * Notification rule for custom event types
 */
export interface NotificationRule {
  /** Unique identifier */
  id: string;
  /** Event type ID(s) this rule applies to */
  eventTypeIds: string[];
  /** Condition function - returns true if notification should be sent */
  condition?: (event: ParsedPluginEvent, payload: Json | null) => boolean;
  /** Priority level */
  priority: "low" | "normal" | "high" | "urgent";
  /** Notification template */
  template?: string;
  /** Whether this rule is enabled */
  enabled: boolean;
}

/**
 * Display template for custom event types
 */
export interface DisplayTemplate {
  /** Event type ID this template applies to */
  eventTypeId: string;
  /** Title template (supports {{variable}} placeholders) */
  titleTemplate: string;
  /** Summary template */
  summaryTemplate: string;
  /** Detail template for expanded view */
  detailTemplate?: string;
  /** Fields to extract and display */
  fields?: DisplayField[];
}

/**
 * Field definition for display templates
 */
export interface DisplayField {
  /** Field key in the event data */
  key: string;
  /** Display label */
  label: string;
  /** Field type for formatting */
  type: "string" | "number" | "date" | "duration" | "json" | "code";
  /** Whether to show in compact view */
  showInCompact?: boolean;
}

/**
 * Plugin definition
 */
export interface EventPlugin {
  /** Unique plugin identifier */
  id: string;
  /** Plugin name */
  name: string;
  /** Plugin version */
  version: string;
  /** Plugin description */
  description?: string;
  /** Author information */
  author?: string;
  /** Source framework this plugin supports */
  framework?: string;
  /** Custom event types defined by this plugin */
  eventTypes: CustomEventType[];
  /** Event parser function */
  parser: EventParser;
  /** Notification rules */
  notificationRules?: NotificationRule[];
  /** Display templates */
  displayTemplates?: DisplayTemplate[];
}

/**
 * Plugin registration options
 */
export interface PluginRegistrationOptions {
  /** Override existing plugin with same ID */
  override?: boolean;
  /** Enable plugin immediately after registration */
  enabled?: boolean;
}

/**
 * Plugin status
 */
export interface PluginStatus {
  id: string;
  name: string;
  version: string;
  enabled: boolean;
  eventTypesCount: number;
  eventsProcessed: number;
  lastEventAt: string | null;
  errors: string[];
}
