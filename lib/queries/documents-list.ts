import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getDocumentsRepository, type DocumentRecord } from "@/lib/repositories/documents";

export interface DocumentListItem extends DocumentRecord {
  clientName: string | null;
}

/** Document list with the related client's name resolved (for the Documents screen). */
export async function listDocumentsWithClient(
  limit = 200,
): Promise<{ items: DocumentListItem[]; total: number }> {
  const { rows, total } = await getDocumentsRepository().list({
    limit,
    orderBy: "created_at",
    ascending: false,
  });

  const clientIds = [...new Set(rows.map((d) => d.clientId).filter((v): v is string => !!v))];
  const names = new Map<string, string>();
  if (clientIds.length) {
    const { data } = await getSupabaseAdmin()
      .from("clients")
      .select("id, first_name, last_name")
      .in("id", clientIds);
    for (const c of data ?? []) names.set(c.id, `${c.first_name} ${c.last_name}`);
  }

  return {
    items: rows.map((d) => ({
      ...d,
      clientName: d.clientId ? (names.get(d.clientId) ?? null) : null,
    })),
    total,
  };
}
