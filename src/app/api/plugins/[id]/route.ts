import { NextResponse } from "next/server";
import { pluginRegistry, initializePlugins } from "@/lib/plugins";

// Ensure plugins are initialized
let initialized = false;
function ensureInitialized() {
  if (!initialized) {
    initializePlugins();
    initialized = true;
  }
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/plugins/[id]
 * Get details of a specific plugin
 */
export async function GET(request: Request, { params }: RouteParams) {
  ensureInitialized();
  
  try {
    const { id } = await params;
    const plugin = pluginRegistry.getPlugin(id);
    
    if (!plugin) {
      return NextResponse.json({ error: "Plugin not found" }, { status: 404 });
    }
    
    const status = pluginRegistry.getPluginStatus(id);
    
    return NextResponse.json({
      plugin: {
        id: plugin.id,
        name: plugin.name,
        version: plugin.version,
        description: plugin.description,
        author: plugin.author,
        framework: plugin.framework,
        eventTypes: plugin.eventTypes,
        notificationRules: plugin.notificationRules,
        displayTemplates: plugin.displayTemplates,
      },
      status,
    });
  } catch (err) {
    console.error("[api/plugins/[id]] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PATCH /api/plugins/[id]
 * Enable or disable a plugin
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  ensureInitialized();
  
  try {
    const { id } = await params;
    const body = await request.json();
    const { enabled } = body as { enabled?: boolean };
    
    const plugin = pluginRegistry.getPlugin(id);
    if (!plugin) {
      return NextResponse.json({ error: "Plugin not found" }, { status: 404 });
    }
    
    if (typeof enabled === "boolean") {
      if (enabled) {
        pluginRegistry.enable(id);
      } else {
        pluginRegistry.disable(id);
      }
    }
    
    return NextResponse.json({
      success: true,
      status: pluginRegistry.getPluginStatus(id),
    });
  } catch (err) {
    console.error("[api/plugins/[id]] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/plugins/[id]
 * Unregister a plugin
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  ensureInitialized();
  
  try {
    const { id } = await params;
    
    // Prevent unregistering built-in plugins
    const builtinPlugins = ["openclaw", "autogen", "crewai"];
    if (builtinPlugins.includes(id)) {
      return NextResponse.json(
        { error: "Cannot unregister built-in plugins" },
        { status: 400 }
      );
    }
    
    const success = pluginRegistry.unregister(id);
    
    if (!success) {
      return NextResponse.json({ error: "Plugin not found" }, { status: 404 });
    }
    
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[api/plugins/[id]] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
