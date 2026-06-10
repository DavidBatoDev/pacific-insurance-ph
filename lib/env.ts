/**
 * Centralized, validated access to environment variables.
 *
 * Values are read lazily via getters so that merely importing this module
 * (or the Supabase admin client) never throws at build time — a variable is
 * only required at the moment it is actually used (i.e. when a request hits a
 * repository). This keeps `next build` working before credentials are set.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Add it to .env.local (see .env.example).`,
    );
  }
  return value;
}

export const env = {
  /** Public — safe to expose to the browser. */
  get SUPABASE_URL(): string {
    return required("NEXT_PUBLIC_SUPABASE_URL");
  },
  /** Public — safe to expose to the browser. */
  get SUPABASE_ANON_KEY(): string {
    return required("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  },
  /** Server-only — bypasses Row-Level Security. Never expose to the browser. */
  get SUPABASE_SERVICE_ROLE_KEY(): string {
    return required("SUPABASE_SERVICE_ROLE_KEY");
  },
} as const;
