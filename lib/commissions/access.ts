import "server-only";

import { getCurrentUser } from "@/lib/auth/current-user";
import { getCommissionsRepository } from "@/lib/repositories/payments";
import type { User } from "@/lib/repositories/users";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { commissionCapabilities, isCommissionVoucher } from "./voucher";

type Actor = User;
type VoucherDocument = { clientId: string | null; commissionId: string | null; documentType: string | null };

export async function requireCommissionActor(): Promise<Actor> {
  const actor = await getCurrentUser();
  if (!actor) throw new Error("Not authenticated.");
  if (actor.status !== "Active") throw new Error("Your account is inactive.");
  return actor;
}

/** Batched client ownership; a missing client or owner fails closed. */
export async function commissionOwners(clientIds: (string | null)[]): Promise<Map<string, string | null>> {
  const ids = [...new Set(clientIds.filter((id): id is string => !!id))];
  if (!ids.length) return new Map();
  const { data, error } = await getSupabaseAdmin().from("clients").select("id, assigned_user_id").in("id", ids);
  if (error) throw error;
  return new Map((data ?? []).map((client) => [client.id, client.assigned_user_id]));
}

export async function requireCommissionAccess(id: string, permission: "canReadVoucher" | "canFileVoucher" | "canUpdateCommission") {
  const actor = await requireCommissionActor();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new Error("Commission not found.");
  const commission = await getCommissionsRepository().findById(id);
  if (!commission) throw new Error("Commission not found.");
  const owners = await commissionOwners([commission.clientId]);
  const capabilities = commissionCapabilities(actor, { clientId: commission.clientId, assignedUserId: commission.clientId ? owners.get(commission.clientId) ?? null : null });
  if (permission === "canFileVoucher" && !commission.clientId && capabilities.canUpdateCommission) throw new Error("This commission has no client; voucher cannot be filed.");
  if (!capabilities[permission]) throw new Error("Commission not found.");
  return { actor, commission, capabilities };
}

/** Guard current and replaced originals alike, requiring a consistent commission/client link. */
export async function filterCommissionVoucherDocuments<T extends VoucherDocument>(documents: T[], actor: Actor | null): Promise<T[]> {
  const vouchers = documents.filter(isCommissionVoucher);
  if (!vouchers.length) return documents;
  if (!actor || actor.status !== "Active") return documents.filter((doc) => !isCommissionVoucher(doc));
  const ids = [...new Set(vouchers.map((doc) => doc.commissionId).filter((id): id is string => !!id))];
  const { data, error } = ids.length ? await getSupabaseAdmin().from("commissions").select("id,client_id").in("id", ids) : { data: [], error: null };
  if (error) throw error;
  const clients = new Map((data ?? []).map((row) => [row.id, row.client_id]));
  const owners = await commissionOwners(vouchers.map((doc) => doc.clientId));
  return documents.filter((doc) => {
    if (!isCommissionVoucher(doc)) return true;
    if (!doc.commissionId || !doc.clientId || clients.get(doc.commissionId) !== doc.clientId) return false;
    return commissionCapabilities(actor, { clientId: doc.clientId, assignedUserId: owners.get(doc.clientId) ?? null }).canReadVoucher;
  });
}
