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

/**
 * GET /api/plugins/event-types
 * List all registered event types across all plugins
 */
export async function GET(request: Request) {
  ensureInitialized();
  
  try {
    const { searchParams } = new URL(request.url);
    const framework = searchParams.get("framework");
    const category = searchParams.get("category");
    
    let eventTypes = pluginRegistry.getAllEventTypes();
    
    if (framework) {
      eventTypes = eventTypes.filter((et) => et.framework === framework);
    }
    
    if (category) {
      eventTypes = eventTypes.filter((et) => et.category === category);
    }
    
    // Group by framework
    const byFramework: Record<string, typeof eventTypes> = {};
    for (const et of eventTypes) {
      const fw = et.framework ?? "unknown";
      if (!byFramework[fw]) byFramework[fw] = [];
      byFramework[fw].push(et);
    }
    
    // Get unique categories
    const categories = [...new Set(eventTypes.map((et) => et.category))];
    
    // Get unique frameworks
    const frameworks = [...new Set(eventTypes.map((et) => et.framework).filter(Boolean))];
    
    return NextResponse.json({
      eventTypes,
      byFramework,
      categories,
      frameworks,
      total: eventTypes.length,
    });
  } catch (err) {
    console.error("[api/plugins/event-types] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
