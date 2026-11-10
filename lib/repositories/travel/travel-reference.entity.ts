import type { TravelPackReferenceKey } from "@/lib/travel/post-issuance-pack";

/** An Inbox attachment part that may be recorded as a Travel supplementary reference. */
export interface TravelReferenceCandidate {
  messageId: string;
  partId: string;
  fileName: string;
  mimeType: string;
  size: number;
  subject: string;
  fromAddress: string;
  receivedAt: string;
  stored: boolean;
  /** The email is linked to the client rather than this trip; recording it needs confirmation. */
  clientLevel: boolean;
  linkedSlots: TravelPackReferenceKey[];
}

export interface TravelReferenceCandidatePage {
  items: TravelReferenceCandidate[];
  nextOffset: number | null;
}

/** A saved link. Source details are null when the actor can no longer read the source email. */
export interface TravelReferenceAttachment {
  slot: TravelPackReferenceKey;
  messageId: string;
  partId: string;
  clientLevel: boolean;
  linkedAt: string;
  linkedByName: string | null;
  available: boolean;
  fileName: string | null;
  mimeType: string | null;
  size: number | null;
  subject: string | null;
  fromAddress: string | null;
  receivedAt: string | null;
  stored: boolean;
}

export interface SetTravelReferenceInput {
  travelRequestId: string;
  slot: TravelPackReferenceKey;
  messageId: string;
  partId: string;
  confirmClientLevel: boolean;
}
