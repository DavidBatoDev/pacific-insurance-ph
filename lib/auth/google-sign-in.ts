import type { User as AuthUser } from "@supabase/supabase-js";

import { normalizeStaffEmail, STAFF_EMAIL_DOMAINS } from "./staff-email";

/** Workspace domain requested from Google (`hd`); a UI hint only, the claim check below is the gate. */
export const GOOGLE_WORKSPACE_DOMAIN = STAFF_EMAIL_DOMAINS[0];

/** Where to land after Google returns; a cookie because the redirect allow-list matches whole URLs. */
export const GOOGLE_NEXT_COOKIE = "google_sign_in_next";
export const GOOGLE_CALLBACK_PATH = "/auth/callback";

export const DEACTIVATED_MESSAGE = "This account has been deactivated. Contact the Owner if you need access restored.";
export const NOT_INVITED_MESSAGE = "This Google account has not been invited to the Operations Hub. Ask Matt for an invitation.";
export const NOT_WORKSPACE_MESSAGE = `Sign in with your Pacific Insurance PH Google Workspace account (@${GOOGLE_WORKSPACE_DOMAIN}).`;

/** Same-origin paths only: rejects absolute and protocol-relative (`//host`, `/\host`) targets. */
export function safeRedirectPath(value: unknown): string {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\")
    ? value
    : "/dashboard";
}

/**
 * Why this Supabase user may not use Google sign-in, or null when its Google identity is an
 * agency Workspace account. Consumer Google accounts carry no hosted-domain claim, and a consumer
 * account registered under an agency address is exactly what this rejects, so a missing `hd`
 * is never "unknown". Supabase keeps Google's `hd` under `custom_claims`; a top-level `hd` is
 * accepted too.
 */
export function googleIdentityProblem(user: Pick<AuthUser, "email" | "identities">): string | null {
  const identity = user.identities?.find((candidate) => candidate.provider === "google");
  if (!identity) return NOT_WORKSPACE_MESSAGE;
  const data = identity.identity_data ?? {};
  const claims = data.custom_claims && typeof data.custom_claims === "object" ? (data.custom_claims as Record<string, unknown>) : {};
  const hostedDomain = claims.hd ?? data.hd;
  if (typeof hostedDomain !== "string" || !(STAFF_EMAIL_DOMAINS as readonly string[]).includes(hostedDomain.toLowerCase())) {
    return NOT_WORKSPACE_MESSAGE;
  }
  const email = typeof data.email === "string" ? normalizeStaffEmail(data.email) : null;
  if (data.email_verified !== true || !email || email !== user.email?.toLowerCase()) return NOT_WORKSPACE_MESSAGE;
  return null;
}
