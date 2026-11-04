import type { OutboundClaim, OutboundEmail, OutboundResult, PrepareOutboundInput } from "./outbound-email.entity";

/** Private service-role port. Actor authorization and state transitions are enforced in SQL. */
export interface OutboundEmailRepository {
  prepare(actorId: string, input: PrepareOutboundInput): Promise<OutboundEmail>;
  claim(actorId: string, id: string): Promise<OutboundClaim>;
  failPrepared(actorId: string, id: string, errorCode: string): Promise<OutboundEmail>;
  finish(id: string, dispatchToken: string, result: OutboundResult): Promise<OutboundEmail>;
  applyEffects(id: string): Promise<OutboundEmail>;
  get(actorId: string, id: string): Promise<OutboundEmail | null>;
  list(actorId: string, clientId: string, replyToMessageId?: string): Promise<OutboundEmail[]>;
}
