/**
 * Supabase admin client for server-side background services (no cookies needed).
 * Used by the watcher service to write events directly.
 */

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";

let adminClient: ReturnType<typeof createSupabaseClient<Database>> | null = null;

export function getAdminClient() {
  if (adminClient) return adminClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "[supabase-admin] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
    );
  }

  adminClient = createSupabaseClient<Database>(url, key);
  return adminClient;
}
