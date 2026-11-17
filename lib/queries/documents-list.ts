import "server-only";

import { getDocumentsRepository, type DocumentRecord } from "@/lib/repositories/documents";
import { getCurrentUser } from "@/lib/auth/current-user";
import { filterCommissionVoucherDocuments } from "@/lib/commissions/access";
import { isCommissionVoucher } from "@/lib/commissions/voucher";

export interface DocumentListItem extends DocumentRecord {
  clientName: string | null;
}

/**
 * Document list with the related client's name resolved (for the Documents screen).
 * `ownerUserId` (from `getAgentScope()`) keeps only an agent's own clients' files.
 */
export async function listDocumentsWithClient(
  limit = 200,
  ownerUserId: string | null = null,
): Promise<{ items: DocumentListItem[]; total: number }> {
  const { rows, total } = await getDocumentsRepository().listWithClientName({
    limit,
    orderBy: "created_at",
    ascending: false,
    ownerUserId,
  });
  const allowed = await filterCommissionVoucherDocuments(rows, await getCurrentUser());
  return {
    items: allowed.map((doc) => isCommissionVoucher(doc) ? { ...doc, filePath: null } : doc),
    total: total - (rows.length - allowed.length),
  };
}
