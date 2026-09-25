import "server-only";

import { getDocumentsRepository, type DocumentRecord } from "@/lib/repositories/documents";

export interface DocumentListItem extends DocumentRecord {
  clientName: string | null;
}

/** Document list with the related client's name resolved (for the Documents screen). */
export async function listDocumentsWithClient(
  limit = 200,
): Promise<{ items: DocumentListItem[]; total: number }> {
  const { rows, total } = await getDocumentsRepository().listWithClientName({
    limit,
    orderBy: "created_at",
    ascending: false,
  });
  return { items: rows, total };
}
