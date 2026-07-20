/**
 * Domain types for Group Accounts — company-level Group HMO records with a
 * member roster (design group.jsx / group-account-page.md).
 */

export interface GroupAccount {
  id: string;
  referenceNo: string | null;
  name: string;
  productName: string | null;
  policyId: string | null;
  policyRef: string | null;
  billingCycle: string;
  premiumAmount: number | null;
  status: string;
  primaryContactId: string | null;
  primaryContactName: string | null;
  primaryContactEmail: string | null;
  assignedUserId: string | null;
  effectiveDate: string | null;
  expiryDate: string | null;
  address: string | null;
  notes: string | null;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface GroupMember {
  id: string;
  groupId: string;
  clientId: string | null;
  fullName: string;
  relationship: string;
  coverageTier: string;
  ecardStatus: string;
  joinDate: string | null;
  status: string;
  createdAt: string;
}

export interface NewGroupAccount {
  name: string;
  productVersionId?: string | null;
  billingCycle?: string;
  premiumAmount?: number | null;
  status?: string;
  primaryContactId?: string | null;
  effectiveDate?: string | null;
  expiryDate?: string | null;
  address?: string | null;
  notes?: string | null;
}

export interface NewGroupMember {
  groupId: string;
  clientId?: string | null;
  fullName: string;
  relationship?: string;
  coverageTier?: string;
  ecardStatus?: string;
  joinDate?: string | null;
  status?: string;
}
