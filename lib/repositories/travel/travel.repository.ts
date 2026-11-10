import type { ListOptions } from "../types";
import type { TravelRequest, NewTravelRequest, TravelRequestUpdate } from "./travel-request.entity";
import type { SetTravelReferenceInput, TravelReferenceAttachment, TravelReferenceCandidatePage } from "./travel-reference.entity";
import type { TravelPackReferenceKey } from "@/lib/travel/post-issuance-pack";

/** The Travel repository port (same shape as ClientsRepository). */
export interface TravelRepository {
  findById(id: string): Promise<TravelRequest | null>;
  /** All travel requests, joined with client names; soonest departure first. */
  list(opts?: ListOptions): Promise<TravelRequest[]>;
  /** Travel requests belonging to one client; soonest departure first. */
  listByClient(clientId: string): Promise<TravelRequest[]>;
  create(input: NewTravelRequest): Promise<TravelRequest>;
  update(id: string, input: TravelRequestUpdate): Promise<TravelRequest>;
  /** Inbox attachment parts eligible for this trip's supplementary references (actor-scoped in SQL). */
  listReferenceCandidates(actorId: string, travelRequestId: string, search: string, offset: number): Promise<TravelReferenceCandidatePage>;
  listReferenceAttachments(actorId: string, travelRequestId: string): Promise<TravelReferenceAttachment[]>;
  setReferenceAttachment(actorId: string, input: SetTravelReferenceInput): Promise<{ changed: boolean }>;
  unlinkReferenceAttachment(actorId: string, travelRequestId: string, slot: TravelPackReferenceKey): Promise<{ changed: boolean }>;
}
