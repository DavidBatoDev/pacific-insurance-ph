import type { Claim, NewClaim, ClaimUpdate } from "./claim.entity";

/** The Claims repository port (same shape as ClientsRepository). */
export interface ClaimsRepository {
  findById(id: string): Promise<Claim | null>;
  /** All claims, joined with client + policy refs; most recently updated first. */
  list(): Promise<Claim[]>;
  /** Claims belonging to one client; most recently updated first. */
  listByClient(clientId: string): Promise<Claim[]>;
  create(input: NewClaim): Promise<Claim>;
  update(id: string, input: ClaimUpdate): Promise<Claim>;
}
