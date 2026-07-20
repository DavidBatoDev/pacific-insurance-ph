"use server";

import { getClientsRepository } from "@/lib/repositories/clients";

export interface PaletteClientHit {
  id: string;
  name: string;
  email: string | null;
  referenceNo: string | null;
  clientType: string;
  status: string;
}

/** Lightweight client search for the ⌘K command palette. */
export async function searchClientsForPalette(query: string): Promise<PaletteClientHit[]> {
  const term = query.trim();
  if (!term) return [];
  const clients = await getClientsRepository().search(term, 8);
  return clients.map((c) => ({
    id: c.id,
    name: c.fullName,
    email: c.email,
    referenceNo: c.referenceNo,
    clientType: c.clientType,
    status: c.status,
  }));
}
