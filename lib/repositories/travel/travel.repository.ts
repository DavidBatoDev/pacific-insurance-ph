import type { TravelRequest, NewTravelRequest, TravelRequestUpdate } from "./travel-request.entity";

/** The Travel repository port (same shape as ClientsRepository). */
export interface TravelRepository {
  findById(id: string): Promise<TravelRequest | null>;
  /** All travel requests, joined with client names; soonest departure first. */
  list(): Promise<TravelRequest[]>;
  /** Travel requests belonging to one client; soonest departure first. */
  listByClient(clientId: string): Promise<TravelRequest[]>;
  create(input: NewTravelRequest): Promise<TravelRequest>;
  update(id: string, input: TravelRequestUpdate): Promise<TravelRequest>;
}
