import type { SentEmailStatus, SentEmailSummary } from "@/lib/communications/sent-email.types";
import type { OutboundClaim, OutboundEmail, OutboundResult, PrepareOutboundInput } from "./outbound-email.entity";

/** Agency-wide history filters; `from`/`to` are ISO instants (`to` exclusive). */
export interface AgencyOutboundFilters {
  query: string;
  status: SentEmailStatus;
  from: string | null;
  to: string | null;
  offset: number;
}

/** Private service-role port. Actor authorization and state transitions are enforced in SQL. */
export interface OutboundEmailRepository {
  prepare(actorId: string, input: PrepareOutboundInput): Promise<OutboundEmail>;
  claim(actorId: string, id: string): Promise<OutboundClaim>;
  failPrepared(actorId: string, id: string, errorCode: string): Promise<OutboundEmail>;
  finish(id: string, dispatchToken: string, result: OutboundResult): Promise<OutboundEmail>;
  applyEffects(id: string): Promise<OutboundEmail>;
  get(actorId: string, id: string): Promise<OutboundEmail | null>;
  list(actorId: string, clientId: string, replyToMessageId?: string): Promise<OutboundEmail[]>;
  /** Display-safe projection only; returns up to one row past the page size. */
  listAgency(actorId: string, filters: AgencyOutboundFilters): Promise<SentEmailSummary[]>;
}
