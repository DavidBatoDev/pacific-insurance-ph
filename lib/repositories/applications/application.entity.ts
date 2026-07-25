/**
 * Domain types for an Application — a client's in-flight product application
 * (docs/data-model; table defined in supabase/migrations/0005_operations.sql).
 */

import type { Json } from "@/lib/supabase/types";

export interface Application {
  id: string;
  referenceNo: string | null;
  clientId: string;
  /** Joined convenience: client's full name. */
  clientName: string | null;
  /** Joined convenience: product name via product_versions → products. */
  productName: string | null;
  applicationType: string;
  /** Workflow-driven, free text (default 'Lead' in the database). */
  status: string;
  assignedUserId: string | null;
  dateStarted: string | null;
  dateSubmitted: string | null;
  notes: string | null;
  wizardState: Json | null;
  createdAt: string;
  updatedAt: string;
}

export interface NewApplication {
  clientId: string;
  productVersionId?: string | null;
  applicationType?: string;
  status?: string;
  assignedUserId?: string | null;
  dateStarted?: string | null;
  notes?: string | null;
  wizardState?: Json | null;
}

export interface ApplicationUpdate {
  status?: string;
  dateSubmitted?: string | null;
  notes?: string | null;
  assignedUserId?: string | null;
  productVersionId?: string | null;
  applicationType?: string;
  dateStarted?: string | null;
  wizardState?: Json | null;
}
