import type { ListOptions } from "../types";
import type { Renewal, NewRenewal, RenewalUpdate } from "./renewal.entity";

/** The Renewals repository port (same shape as ClientsRepository). */
export interface RenewalsRepository {
  findById(id: string): Promise<Renewal | null>;
  /** All renewals, joined with client + policy details; soonest due first. */
  list(opts?: ListOptions): Promise<Renewal[]>;
  /** Renewals belonging to one client; soonest due first. */
  listByClient(clientId: string): Promise<Renewal[]>;
  create(input: NewRenewal): Promise<Renewal>;
  update(id: string, input: RenewalUpdate): Promise<Renewal>;
}
