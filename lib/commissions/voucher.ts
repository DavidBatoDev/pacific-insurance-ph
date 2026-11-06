import { toAppRole } from "@/lib/auth/permissions";

export const COMMISSION_VOUCHER_DOCUMENT_TYPE = "Commission Voucher";

/** Either marker is confidential, including malformed/orphaned originals. */
export function isCommissionVoucher(document: { documentType: string | null; commissionId: string | null }): boolean {
  return document.documentType === COMMISSION_VOUCHER_DOCUMENT_TYPE || document.commissionId != null;
}

export function commissionCapabilities(
  actor: { id: string; role: string; status: string } | null,
  commission: { clientId: string | null; assignedUserId: string | null },
): { canReadVoucher: boolean; canFileVoucher: boolean; canUpdateCommission: boolean } {
  const role = actor ? toAppRole(actor.role) : null;
  const permitted = actor?.status === "Active" && (role === "admin" || (!!commission.clientId && !!commission.assignedUserId && commission.assignedUserId === actor.id));
  return {
    canReadVoucher: permitted,
    canFileVoucher: permitted && role !== "agent" && !!commission.clientId,
    canUpdateCommission: permitted && role !== "agent",
  };
}
