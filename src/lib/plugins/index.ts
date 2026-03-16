/**
 * Plugin System
 * 
 * Central module for the event type plugin system.
 * Provides APIs for registering custom event types, parsers,
 * notification rules, and display templates.
 */

// Export types
export type {
  CustomEventType,
  EventParser,
  EventParserMetadata,
  ParsedPluginEvent,
  NotificationRule,
  DisplayTemplate,
  DisplayField,
  EventPlugin,
  PluginRegistrationOptions,
  PluginStatus,
} from "./types";

// Export registry
export { pluginRegistry } from "./registry";

// Export built-in plugins
export { openclawPlugin, autogenPlugin, crewaiPlugin } from "./builtin";

// Re-export for convenience
import { pluginRegistry } from "./registry";
import { openclawPlugin, autogenPlugin, crewaiPlugin } from "./builtin";

/**
 * Initialize the plugin system with built-in plugins.
 * Call this once during application startup.
 */
export function initializePlugins(): void {
  // Register built-in plugins
  pluginRegistry.register(openclawPlugin, { override: true });
  pluginRegistry.register(autogenPlugin, { override: true });
  pluginRegistry.register(crewaiPlugin, { override: true });
  
  console.log("[plugins] Initialized with built-in plugins");
}

/**
 * Get a summary of all registered plugins
 */
export function getPluginsSummary(): {
  total: number;
  enabled: number;
  eventTypes: number;
  frameworks: string[];
} {
  const plugins = pluginRegistry.getAllPlugins();
  const enabledPlugins = pluginRegistry.getEnabledPlugins();
  const eventTypes = pluginRegistry.getAllEventTypes();
  const frameworks = [...new Set(eventTypes.map((et) => et.framework).filter(Boolean))] as string[];
  
  return {
    total: plugins.length,
    enabled: enabledPlugins.length,
    eventTypes: eventTypes.length,
    frameworks,
  };
}
