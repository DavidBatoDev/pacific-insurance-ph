/**
 * Domain types for a Client.
 *
 * camelCase and decoupled from the raw Postgres row shape (snake_case). The
 * Supabase repository maps between the two, so the rest of the app never sees
 * database column names.
 */

export interface Client {
  id: string;
  referenceNo: string | null;
  firstName: string;
  lastName: string;
  /** Derived convenience field: "First Last". */
  fullName: string;
  dateOfBirth: string | null;
  email: string | null;
  mobileNumber: string | null;
  address: string | null;
  preferredChannel: string | null;
  clientType: string;
  vipStatus: boolean;
  leadSource: string | null;
  assignedUserId: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Fields accepted when creating a Client. */
export interface NewClient {
  firstName: string;
  lastName: string;
  dateOfBirth?: string | null;
  email?: string | null;
  mobileNumber?: string | null;
  address?: string | null;
  preferredChannel?: string | null;
  clientType?: string;
  vipStatus?: boolean;
  leadSource?: string | null;
  assignedUserId?: string | null;
  status?: string;
  notes?: string | null;
}

/** Fields accepted when updating a Client (all optional). */
export interface ClientUpdate {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string | null;
  email?: string | null;
  mobileNumber?: string | null;
  address?: string | null;
  preferredChannel?: string | null;
  clientType?: string;
  vipStatus?: boolean;
  leadSource?: string | null;
  assignedUserId?: string | null;
  status?: string;
  notes?: string | null;
}
