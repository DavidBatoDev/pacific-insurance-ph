import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { env } from "@/lib/env";
import type { Database } from "./types";

/**
 * Cookie-bound Supabase client (ANON key) for AUTH/session only.
 *
 * Use this for sign-in/out and reading the current session. It is NOT the data
 * path — all data access goes through the service-role repositories
 * (lib/repositories/*). Session cookies are refreshed by the proxy on navigation.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component (cookies are read-only there). Safe to
          // ignore — the proxy refreshes the session cookie on the next navigation.
        }
      },
    },
  });
}
