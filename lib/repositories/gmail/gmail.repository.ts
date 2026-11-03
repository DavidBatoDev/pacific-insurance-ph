import type {
  GmailAttempt,
  GmailConnection,
  GmailConnectionSummary,
  NewGmailConnection,
} from "./gmail-connection.entity";

export interface GmailRepository {
  getSummary(): Promise<GmailConnectionSummary | null>;
  getCredentials(): Promise<GmailConnection | null>;
  createAttempt(input: GmailAttempt): Promise<void>;
  /** Atomically consumes a matching, unexpired attempt; replay returns null. */
  consumeAttempt(
    stateHash: string,
    actorId: string,
    browserBindingHash: string,
  ): Promise<GmailAttempt | null>;
  /** Revision zero means no connection; false means a newer write won. */
  saveConnection(
    input: NewGmailConnection,
    expectedRevision: number,
    actorId: string,
  ): Promise<boolean>;
  recordCheck(
    expectedRevision: number,
    actorId: string,
    status: GmailConnection["status"],
    errorCode: string | null,
  ): Promise<boolean>;
}
