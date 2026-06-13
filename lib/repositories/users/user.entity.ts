/**
 * Domain types for a staff User.
 *
 * `id` mirrors the Supabase Auth user id (auth.users), so creating a User
 * record requires an existing auth user. camelCase, decoupled from the row shape.
 */

export interface User {
  id: string;
  referenceNo: string | null;
  fullName: string;
  email: string;
  role: string;
  status: string;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Fields accepted when creating a User (id comes from Supabase Auth). */
export interface NewUser {
  id: string;
  fullName: string;
  email: string;
  role?: string;
  status?: string;
}

/** Fields accepted when updating a User (all optional). */
export interface UserUpdate {
  fullName?: string;
  email?: string;
  role?: string;
  status?: string;
  lastLoginAt?: string | null;
}
