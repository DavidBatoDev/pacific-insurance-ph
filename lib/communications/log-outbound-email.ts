import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";

/** One campaign/payment-link recipient. Logged only: nothing is transmitted. */
export interface BatchEmailLog {
  clientId: string;
  applicationId?: string | null;
  subject: string;
  summary: string;
  notes?: string | null;
  actorId: string;
  externalContactId?: string | null;
}

/**
 * Records fan-out emails (campaigns, payment links) as `delivery_status = 'logged'`. These are
 * never routed through Gmail; individual reviewed emails use the outbound Gmail ledger instead.
 * One insert; atomic per Postgres statement, so a failure logs nothing rather than a partial batch.
 */
export async function logOutboundEmails(batch: BatchEmailLog[]): Promise<number> {
  if (batch.length === 0) return 0;
  const { error } = await getSupabaseAdmin().from("communications").insert(
    batch.map((input) => ({
      client_id: input.clientId, direction: "Outbound", channel: "Gmail",
      application_id: input.applicationId ?? null,
      subject: input.subject, summary: input.summary, notes: input.notes ?? null,
      related_user_id: input.actorId, external_contact_id: input.externalContactId ?? null,
      delivery_status: "logged",
    })),
  );
  if (error) throw new Error(error.message);
  return batch.length;
}
