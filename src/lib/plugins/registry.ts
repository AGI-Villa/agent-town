/**
 * Plugin Registry
 * 
 * Central registry for managing event type plugins.
 * Handles plugin registration, event parsing, and notification rules.
 */

import type { Json } from "../database.types";
import type {
  EventPlugin,
  CustomEventType,
  EventParser,
  ParsedPluginEvent,
  NotificationRule,
  DisplayTemplate,
  PluginRegistrationOptions,
  PluginStatus,
  EventParserMetadata,
} from "./types";

class PluginRegistry {
  private plugins: Map<string, EventPlugin> = new Map();
  private enabledPlugins: Set<string> = new Set();
  private eventTypeIndex: Map<string, string> = new Map(); // eventTypeId -> pluginId
  private stats: Map<string, { eventsProcessed: number; lastEventAt: string | null; errors: string[] }> = new Map();

  /**
   * Register a new plugin
   */
  register(plugin: EventPlugin, options: PluginRegistrationOptions = {}): void {
    const { override = false, enabled = true } = options;

    if (this.plugins.has(plugin.id) && !override) {
      throw new Error(`Plugin "${plugin.id}" is already registered. Use override option to replace.`);
    }

    // Validate plugin
    this.validatePlugin(plugin);

    // Register plugin
    this.plugins.set(plugin.id, plugin);
    
    // Index event types
    for (const eventType of plugin.eventTypes) {
      if (this.eventTypeIndex.has(eventType.id) && !override) {
        const existingPluginId = this.eventTypeIndex.get(eventType.id);
        console.warn(
          `[plugin-registry] Event type "${eventType.id}" already registered by plugin "${existingPluginId}". ` +
          `Plugin "${plugin.id}" will override it.`
        );
      }
      this.eventTypeIndex.set(eventType.id, plugin.id);
    }

    // Initialize stats
    this.stats.set(plugin.id, {
      eventsProcessed: 0,
      lastEventAt: null,
      errors: [],
    });

    // Enable if requested
    if (enabled) {
      this.enabledPlugins.add(plugin.id);
    }

    console.log(
      `[plugin-registry] Registered plugin "${plugin.name}" (${plugin.id}) v${plugin.version} ` +
      `with ${plugin.eventTypes.length} event types`
    );
  }

  /**
   * Unregister a plugin
   */
  unregister(pluginId: string): boolean {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return false;

    // Remove event type index entries
    for (const eventType of plugin.eventTypes) {
      if (this.eventTypeIndex.get(eventType.id) === pluginId) {
        this.eventTypeIndex.delete(eventType.id);
      }
    }

    this.plugins.delete(pluginId);
    this.enabledPlugins.delete(pluginId);
    this.stats.delete(pluginId);

    console.log(`[plugin-registry] Unregistered plugin "${pluginId}"`);
    return true;
  }

  /**
   * Enable a plugin
   */
  enable(pluginId: string): boolean {
    if (!this.plugins.has(pluginId)) return false;
    this.enabledPlugins.add(pluginId);
    return true;
  }

  /**
   * Disable a plugin
   */
  disable(pluginId: string): boolean {
    return this.enabledPlugins.delete(pluginId);
  }

  /**
   * Check if a plugin is enabled
   */
  isEnabled(pluginId: string): boolean {
    return this.enabledPlugins.has(pluginId);
  }

  /**
   * Get a plugin by ID
   */
  getPlugin(pluginId: string): EventPlugin | undefined {
    return this.plugins.get(pluginId);
  }

  /**
   * Get all registered plugins
   */
  getAllPlugins(): EventPlugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Get all enabled plugins
   */
  getEnabledPlugins(): EventPlugin[] {
    return Array.from(this.plugins.values()).filter((p) => this.enabledPlugins.has(p.id));
  }

  /**
   * Get a custom event type by ID
   */
  getEventType(eventTypeId: string): CustomEventType | undefined {
    const pluginId = this.eventTypeIndex.get(eventTypeId);
    if (!pluginId) return undefined;
    
    const plugin = this.plugins.get(pluginId);
    return plugin?.eventTypes.find((et) => et.id === eventTypeId);
  }

  /**
   * Get all registered event types
   */
  getAllEventTypes(): CustomEventType[] {
    const eventTypes: CustomEventType[] = [];
    for (const plugin of this.plugins.values()) {
      eventTypes.push(...plugin.eventTypes);
    }
    return eventTypes;
  }

  /**
   * Get event types by framework
   */
  getEventTypesByFramework(framework: string): CustomEventType[] {
    return this.getAllEventTypes().filter((et) => et.framework === framework);
  }

  /**
   * Get display template for an event type
   */
  getDisplayTemplate(eventTypeId: string): DisplayTemplate | undefined {
    const pluginId = this.eventTypeIndex.get(eventTypeId);
    if (!pluginId) return undefined;

    const plugin = this.plugins.get(pluginId);
    return plugin?.displayTemplates?.find((t) => t.eventTypeId === eventTypeId);
  }

  /**
   * Get notification rules for an event type
   */
  getNotificationRules(eventTypeId: string): NotificationRule[] {
    const rules: NotificationRule[] = [];
    
    for (const plugin of this.getEnabledPlugins()) {
      if (!plugin.notificationRules) continue;
      
      for (const rule of plugin.notificationRules) {
        if (rule.enabled && rule.eventTypeIds.includes(eventTypeId)) {
          rules.push(rule);
        }
      }
    }
    
    return rules;
  }

  /**
   * Parse an event through all enabled plugins
   * Returns the first successful parse result
   */
  parseEvent(
    eventType: string,
    payload: Json | null,
    metadata?: EventParserMetadata
  ): ParsedPluginEvent | null {
    for (const plugin of this.getEnabledPlugins()) {
      try {
        const result = plugin.parser(eventType, payload, metadata);
        if (result) {
          // Update stats
          const stats = this.stats.get(plugin.id);
          if (stats) {
            stats.eventsProcessed++;
            stats.lastEventAt = new Date().toISOString();
          }
          return result;
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        this.addPluginError(plugin.id, `Parse error: ${errorMsg}`);
      }
    }
    return null;
  }

  /**
   * Get plugin status
   */
  getPluginStatus(pluginId: string): PluginStatus | undefined {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return undefined;

    const stats = this.stats.get(pluginId) ?? {
      eventsProcessed: 0,
      lastEventAt: null,
      errors: [],
    };

    return {
      id: plugin.id,
      name: plugin.name,
      version: plugin.version,
      enabled: this.enabledPlugins.has(pluginId),
      eventTypesCount: plugin.eventTypes.length,
      eventsProcessed: stats.eventsProcessed,
      lastEventAt: stats.lastEventAt,
      errors: stats.errors.slice(-10),
    };
  }

  /**
   * Get status of all plugins
   */
  getAllPluginStatus(): PluginStatus[] {
    return Array.from(this.plugins.keys())
      .map((id) => this.getPluginStatus(id))
      .filter((s): s is PluginStatus => s !== undefined);
  }

  /**
   * Validate a plugin before registration
   */
  private validatePlugin(plugin: EventPlugin): void {
    if (!plugin.id || typeof plugin.id !== "string") {
      throw new Error("Plugin must have a valid id");
    }
    if (!plugin.name || typeof plugin.name !== "string") {
      throw new Error("Plugin must have a valid name");
    }
    if (!plugin.version || typeof plugin.version !== "string") {
      throw new Error("Plugin must have a valid version");
    }
    if (!Array.isArray(plugin.eventTypes)) {
      throw new Error("Plugin must have an eventTypes array");
    }
    if (typeof plugin.parser !== "function") {
      throw new Error("Plugin must have a parser function");
    }

    // Validate event types
    for (const eventType of plugin.eventTypes) {
      if (!eventType.id || !eventType.name || !eventType.icon) {
        throw new Error(`Invalid event type in plugin "${plugin.id}": missing required fields`);
      }
    }
  }

  /**
   * Add an error to plugin stats
   */
  private addPluginError(pluginId: string, error: string): void {
    const stats = this.stats.get(pluginId);
    if (stats) {
      stats.errors.push(`${new Date().toISOString()} ${error}`);
      if (stats.errors.length > 50) {
        stats.errors = stats.errors.slice(-50);
      }
    }
    console.error(`[plugin-registry] Plugin "${pluginId}": ${error}`);
  }
}

// Singleton instance
export const pluginRegistry = new PluginRegistry();
