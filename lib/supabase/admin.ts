import "server-only";
import "./ws-polyfill";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { env } from "@/lib/env";
import type { Database } from "./types";

/**
 * Service-role Supabase client.
 *
 * This is the single point where the application talks to Postgres. It uses the
 * SERVICE ROLE key, which BYPASSES Row-Level Security — so it must only ever run
 * on the server. The `import "server-only"` directive above makes the build fail
 * if this module is ever pulled into a Client Component bundle.
 *
 * Do not import this directly from application code. Go through a repository
 * (lib/repositories/*) so that data access stays behind a swappable interface.
 */
let client: SupabaseClient<Database> | null = null;

export function getSupabaseAdmin(): SupabaseClient<Database> {
  if (!client) {
    client = createClient<Database>(
      env.SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );
  }
  return client;
}
