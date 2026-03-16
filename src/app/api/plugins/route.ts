import { NextResponse } from "next/server";
import {
  pluginRegistry,
  initializePlugins,
  getPluginsSummary,
  type EventPlugin,
  type PluginRegistrationOptions,
} from "@/lib/plugins";

// Ensure plugins are initialized
let initialized = false;
function ensureInitialized() {
  if (!initialized) {
    initializePlugins();
    initialized = true;
  }
}

/**
 * GET /api/plugins
 * List all registered plugins and their status
 */
export async function GET(request: Request) {
  ensureInitialized();
  
  try {
    const { searchParams } = new URL(request.url);
    const framework = searchParams.get("framework");
    const enabledOnly = searchParams.get("enabled") === "true";
    
    let plugins = enabledOnly
      ? pluginRegistry.getEnabledPlugins()
      : pluginRegistry.getAllPlugins();
    
    if (framework) {
      plugins = plugins.filter((p) => p.framework === framework);
    }
    
    const pluginStatuses = plugins.map((p) => pluginRegistry.getPluginStatus(p.id));
    const summary = getPluginsSummary();
    
    return NextResponse.json({
      plugins: pluginStatuses,
      summary,
    });
  } catch (err) {
    console.error("[api/plugins] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/plugins
 * Register a new plugin (for dynamic plugin loading)
 */
export async function POST(request: Request) {
  ensureInitialized();
  
  try {
    const body = await request.json();
    const { plugin, options } = body as {
      plugin: EventPlugin;
      options?: PluginRegistrationOptions;
    };
    
    if (!plugin || !plugin.id || !plugin.name) {
      return NextResponse.json(
        { error: "Invalid plugin: missing required fields (id, name)" },
        { status: 400 }
      );
    }
    
    // Validate parser is a string (will be eval'd - security consideration)
    // In production, you'd want a more secure approach
    if (typeof plugin.parser !== "function") {
      return NextResponse.json(
        { error: "Plugin parser must be a function" },
        { status: 400 }
      );
    }
    
    pluginRegistry.register(plugin, options);
    
    return NextResponse.json({
      success: true,
      plugin: pluginRegistry.getPluginStatus(plugin.id),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[api/plugins] Registration error:", message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
