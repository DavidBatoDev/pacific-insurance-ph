import type { TravelRepository } from "./travel.repository";
import { SupabaseTravelRepository } from "./travel.repository.supabase";

let instance: TravelRepository | null = null;

/** Resolve the Travel repository (see clients/index.ts for the pattern). */
export function getTravelRepository(): TravelRepository {
  if (!instance) {
    instance = new SupabaseTravelRepository();
  }
  return instance;
}

export type { TravelRepository } from "./travel.repository";
export type { TravelRequest, NewTravelRequest, TravelRequestUpdate } from "./travel-request.entity";
