import type { ListOptions } from "../types";
import type { Renewal, NewRenewal, RenewalUpdate, RenewalSyncResult } from "./renewal.entity";

/** The Renewals repository port (same shape as ClientsRepository). */
export interface RenewalsRepository {
  findById(id: string): Promise<Renewal | null>;
  /** All renewals, joined with client + policy details; soonest due first. */
  list(opts?: ListOptions): Promise<Renewal[]>;
  /** Renewals belonging to one client; soonest due first. */
  listByClient(clientId: string): Promise<Renewal[]>;
  create(input: NewRenewal): Promise<Renewal>;
  update(id: string, input: RenewalUpdate): Promise<Renewal>;
  /**
   * Conditional update: applies `patch` only while the renewal's status is one of `from`, in one
   * statement. Null means no row matched (missing, or already moved on) and nothing was written.
   */
  transition(id: string, from: readonly string[], patch: RenewalUpdate): Promise<Renewal | null>;
  /**
   * Close a Paid cycle as Renewed and set the policy Active with `newExpiryDate`, atomically in SQL
   * (`complete_renewal`), which also opens the next cycle and writes the audit/timeline entries.
   * `expectedUpdatedAt` is the revision the caller saw; a changed row is rejected.
   */
  completeRenewal(id: string, actorId: string, expectedUpdatedAt: string, newExpiryDate: string): Promise<Renewal>;
  /** Close an overdue, unpaid cycle as Lapsed atomically in SQL (`lapse_renewal`). */
  lapseRenewal(id: string, actorId: string, expectedUpdatedAt: string): Promise<Renewal>;
  /** Explicit, idempotent backfill of every active policy through the database routine. */
  synchronizeFromPolicies(): Promise<RenewalSyncResult[]>;
}
