import { NextResponse } from "next/server";
import { getConfig } from "@/lib/openclaw-gateway";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const config = await getConfig();
    
    if (!config) {
      return NextResponse.json(
        { error: "Configuration not found" },
        { status: 404 }
      );
    }

    // Sanitize sensitive fields
    const sanitized = { ...config };
    
    // Remove or mask sensitive keys
    const sensitiveKeys = ["apiKey", "token", "secret", "password", "key"];
    const maskSensitive = (obj: Record<string, unknown>, path = ""): Record<string, unknown> => {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase();
        if (sensitiveKeys.some((sk) => lowerKey.includes(sk))) {
          result[key] = "***REDACTED***";
        } else if (value && typeof value === "object" && !Array.isArray(value)) {
          result[key] = maskSensitive(value as Record<string, unknown>, `${path}.${key}`);
        } else {
          result[key] = value;
        }
      }
      return result;
    };

    const safeConfig = maskSensitive(sanitized as Record<string, unknown>);

    return NextResponse.json({ config: safeConfig });
  } catch (error) {
    console.error("[gateway/config] Error:", error);
    return NextResponse.json(
      { error: "Failed to get configuration" },
      { status: 500 }
    );
  }
}
