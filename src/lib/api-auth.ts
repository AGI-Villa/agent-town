import { NextResponse } from "next/server";

/**
 * Verify that a request is authorized to access admin/internal endpoints.
 *
 * Accepts requests that match ANY of these conditions:
 *   1. Bearer token matches ADMIN_API_KEY env var
 *   2. Request comes from the server itself (instrumentation.ts cron)
 *      — identified by X-Internal-Token header matching ADMIN_API_KEY
 *   3. ADMIN_API_KEY is not set (open access, for local dev)
 *
 * Returns null if authorized, or a 401 NextResponse if not.
 */
export function requireAuth(request: Request): NextResponse | null {
  const apiKey = process.env.ADMIN_API_KEY;

  if (!apiKey) return null;

  const authHeader = request.headers.get("authorization");
  if (authHeader === `Bearer ${apiKey}`) return null;

  const internalToken = request.headers.get("x-internal-token");
  if (internalToken === apiKey) return null;

  return NextResponse.json(
    { error: "Unauthorized. Provide a valid Bearer token or set ADMIN_API_KEY." },
    { status: 401 }
  );
}
