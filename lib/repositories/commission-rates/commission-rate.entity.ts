/**
 * Effective-dated commission rates per product x business type
 * (Settings -> Commission rates; H9a). `ratePct` null = rate still pending.
 */

import type { CommissionBusinessType } from "@/lib/db-enums";

export interface CommissionRate {
  id: string;
  productId: string;
  productName: string;
  businessType: CommissionBusinessType;
  /** Percentage of premium (0-100); null = pending / not yet confirmed. */
  ratePct: number | null;
  effectiveDate: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NewCommissionRate {
  productId: string;
  businessType: CommissionBusinessType;
  ratePct: number | null;
  effectiveDate: string;
  notes?: string | null;
}

export interface CommissionRateUpdate {
  ratePct?: number | null;
  effectiveDate?: string;
  notes?: string | null;
}
