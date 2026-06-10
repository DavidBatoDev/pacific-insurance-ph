/**
 * Domain types for a Client.
 *
 * Deliberately camelCase and decoupled from the raw Postgres row shape
 * (snake_case). The Supabase repository maps between the two, so the rest of the
 * app never sees database column names.
 */

export interface Client {
  id: string;
  fullName: string;
  email: string | null;
  createdAt: string;
}

/** Fields accepted when creating a Client. */
export interface NewClient {
  fullName: string;
  email?: string | null;
}

/** Fields accepted when updating a Client (all optional). */
export interface ClientUpdate {
  fullName?: string;
  email?: string | null;
}
