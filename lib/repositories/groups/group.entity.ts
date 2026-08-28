/**
 * Domain types for Group Accounts — company-level Group HMO records with a
 * member roster (see group-account-page.md).
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
  /** CET (Corporate Enrollment Template) fields — see migration 0030. */
  lastName: string | null;
  firstName: string | null;
  middleInitial: string | null;
  gender: string | null;
  civilStatus: string | null;
  nationality: string | null;
  birthDate: string | null;
  placeOfBirth: string | null;
  /** CET coverage effective date. Distinct from joinDate. */
  effectiveDate: string | null;
  occupationGrade: string | null;
  roomAndBoardPlan: string | null;
  maximumBenefitLimit: number | null;
  philhealthMember: boolean | null;
  address: string | null;
  email: string | null;
  mobileNumber: string | null;
  landlineNumber: string | null;
  beneficiaryName: string | null;
  beneficiaryBirthDate: string | null;
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
  /** CET (Corporate Enrollment Template) fields — see migration 0030. */
  lastName?: string | null;
  firstName?: string | null;
  middleInitial?: string | null;
  gender?: string | null;
  civilStatus?: string | null;
  nationality?: string | null;
  birthDate?: string | null;
  placeOfBirth?: string | null;
  /** CET coverage effective date. Distinct from joinDate. */
  effectiveDate?: string | null;
  occupationGrade?: string | null;
  roomAndBoardPlan?: string | null;
  maximumBenefitLimit?: number | null;
  philhealthMember?: boolean | null;
  address?: string | null;
  email?: string | null;
  mobileNumber?: string | null;
  landlineNumber?: string | null;
  beneficiaryName?: string | null;
  beneficiaryBirthDate?: string | null;
}
