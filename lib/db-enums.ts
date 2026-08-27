/**
 * App-side copies of the DB CHECK-constraint vocabularies.
 *
 * The migrations named on each constant are the authority. The generated
 * `lib/supabase/types.ts` types these columns as plain `string`, so TypeScript
 * offers no protection: a value that drifts from the constraint surfaces only
 * as a runtime Postgres 23514 check violation. Change a value in the
 * migration ⇒ change it here (and vice versa).
 */

/** `clients.preferred_channel` — supabase/migrations/0002_identity.sql. */
export const PREFERRED_CHANNELS = [
  "Gmail",
  "Phone",
  "Viber",
  "WhatsApp",
  "iMessage",
  "In-Person",
  "Other",
] as const;

/** `clients.client_type` — supabase/migrations/0002_identity.sql. */
export const CLIENT_TYPES = [
  "Prospect",
  "Individual Client",
  "Family Client",
  "Corporate Contact",
  "Former Client",
] as const;

/** `communications.channel` — supabase/migrations/0007_work.sql (adds SMS). */
export const COMMUNICATION_CHANNELS = [
  "Gmail",
  "Phone",
  "Viber",
  "WhatsApp",
  "iMessage",
  "In-Person",
  "SMS",
  "Other",
] as const;

/**
 * The deliberate subset offered by the Contact Profile "Log Message" tab: an
 * inbound *message* is never Gmail / Phone / In-Person — those arrive as
 * logged emails, calls or notes — so only the messaging channels + Other show.
 */
export const MESSAGE_LOG_CHANNELS = ["WhatsApp", "Viber", "iMessage", "SMS", "Other"] as const;
