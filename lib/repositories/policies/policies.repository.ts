import type { ListOptions } from "../types";
import type { Policy, NewPolicy, PolicyUpdate } from "./policy.entity";

/** The Policies repository port (same shape as ClientsRepository). */
export interface PoliciesRepository {
  findById(id: string): Promise<Policy | null>;
  /** All policies, joined with client/product/plan names; newest first. */
  list(opts?: ListOptions): Promise<Policy[]>;
  /** Policies belonging to one client; newest first. */
  listByClient(clientId: string): Promise<Policy[]>;
  create(input: NewPolicy): Promise<Policy>;
  update(id: string, input: PolicyUpdate): Promise<Policy>;
}
