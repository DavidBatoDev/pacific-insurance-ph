import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";
import { DEFAULT_LIST_LIMIT, statusListLiteral, toRepositoryError, type ListOptions } from "../types";
import type {
  GroupAccount,
  GroupMember,
  NewGroupAccount,
  NewGroupMember,
} from "./group.entity";
import type { GroupsRepository } from "./groups.repository";

type GroupRow = Database["public"]["Tables"]["group_accounts"]["Row"];
type MemberRow = Database["public"]["Tables"]["group_members"]["Row"];

type GroupJoined = GroupRow & {
  product_versions: { product: { name: string } | null } | null;
  policies: { reference_no: string | null } | null;
  primary_contact: { first_name: string; last_name: string; email: string | null } | null;
  group_members: { count: number }[];
};

const GROUP_SELECT = `*,
  product_versions (product:products (name)),
  policies (reference_no),
  primary_contact:clients (first_name, last_name, email),
  group_members (count)`;

function groupToDomain(row: GroupJoined): GroupAccount {
  return {
    id: row.id,
    referenceNo: row.reference_no,
    name: row.name,
    productName: row.product_versions?.product?.name ?? null,
    policyId: row.policy_id,
    policyRef: row.policies?.reference_no ?? null,
    billingCycle: row.billing_cycle,
    premiumAmount: row.premium_amount,
    status: row.status,
    primaryContactId: row.primary_contact_id,
    primaryContactName: row.primary_contact
      ? [row.primary_contact.first_name, row.primary_contact.last_name].filter(Boolean).join(" ")
      : null,
    primaryContactEmail: row.primary_contact?.email ?? null,
    assignedUserId: row.assigned_user_id,
    effectiveDate: row.effective_date,
    expiryDate: row.expiry_date,
    address: row.address,
    notes: row.notes,
    memberCount: row.group_members?.[0]?.count ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function memberToDomain(row: MemberRow): GroupMember {
  return {
    id: row.id,
    groupId: row.group_id,
    clientId: row.client_id,
    fullName: row.full_name,
    relationship: row.relationship,
    coverageTier: row.coverage_tier,
    ecardStatus: row.ecard_status,
    joinDate: row.join_date,
    status: row.status,
    createdAt: row.created_at,
    lastName: row.last_name,
    firstName: row.first_name,
    middleInitial: row.middle_initial,
    gender: row.gender,
    civilStatus: row.civil_status,
    nationality: row.nationality,
    birthDate: row.birth_date,
    placeOfBirth: row.place_of_birth,
    effectiveDate: row.effective_date,
    occupationGrade: row.occupation_grade,
    roomAndBoardPlan: row.room_and_board_plan,
    maximumBenefitLimit: row.maximum_benefit_limit,
    philhealthMember: row.philhealth_member,
    address: row.address,
    email: row.email,
    mobileNumber: row.mobile_number,
    landlineNumber: row.landline_number,
    beneficiaryName: row.beneficiary_name,
    beneficiaryBirthDate: row.beneficiary_birth_date,
  };
}

/** supabase-js (service role) implementation of {@link GroupsRepository}. */
export class SupabaseGroupsRepository implements GroupsRepository {
  async findById(id: string): Promise<GroupAccount | null> {
    const { data, error } = await getSupabaseAdmin()
      .from("group_accounts")
      .select(GROUP_SELECT)
      .eq("id", id)
      .maybeSingle<GroupJoined>();
    if (error) throw toRepositoryError("GroupsRepository.findById", error);
    return data ? groupToDomain(data) : null;
  }

  async list(opts: ListOptions = {}): Promise<GroupAccount[]> {
    let query = getSupabaseAdmin().from("group_accounts").select(GROUP_SELECT);
    if (opts.statusIn) query = query.in("status", opts.statusIn);
    if (opts.statusNotIn) query = query.not("status", "in", statusListLiteral(opts.statusNotIn));
    const { data, error } = await query
      .order("premium_amount", { ascending: false, nullsFirst: false })
      .limit(opts.limit ?? DEFAULT_LIST_LIMIT)
      .returns<GroupJoined[]>();
    if (error) throw toRepositoryError("GroupsRepository.list", error);
    return (data ?? []).map(groupToDomain);
  }

  async create(input: NewGroupAccount): Promise<GroupAccount> {
    const { data, error } = await getSupabaseAdmin()
      .from("group_accounts")
      .insert({
        name: input.name,
        product_version_id: input.productVersionId ?? null,
        ...(input.billingCycle !== undefined ? { billing_cycle: input.billingCycle } : {}),
        premium_amount: input.premiumAmount ?? null,
        ...(input.status !== undefined ? { status: input.status } : {}),
        primary_contact_id: input.primaryContactId ?? null,
        effective_date: input.effectiveDate ?? null,
        expiry_date: input.expiryDate ?? null,
        address: input.address ?? null,
        notes: input.notes ?? null,
      })
      .select(GROUP_SELECT)
      .single<GroupJoined>();
    if (error) throw toRepositoryError("GroupsRepository.create", error);
    return groupToDomain(data);
  }

  async update(id: string, input: Partial<NewGroupAccount>): Promise<GroupAccount> {
    const patch: Database["public"]["Tables"]["group_accounts"]["Update"] = {};
    if (input.name !== undefined) patch.name = input.name;
    if (input.billingCycle !== undefined) patch.billing_cycle = input.billingCycle;
    if (input.premiumAmount !== undefined) patch.premium_amount = input.premiumAmount;
    if (input.status !== undefined) patch.status = input.status;
    if (input.primaryContactId !== undefined) patch.primary_contact_id = input.primaryContactId;
    if (input.effectiveDate !== undefined) patch.effective_date = input.effectiveDate;
    if (input.expiryDate !== undefined) patch.expiry_date = input.expiryDate;
    if (input.address !== undefined) patch.address = input.address;
    if (input.notes !== undefined) patch.notes = input.notes;

    const { data, error } = await getSupabaseAdmin()
      .from("group_accounts")
      .update(patch)
      .eq("id", id)
      .select(GROUP_SELECT)
      .single<GroupJoined>();
    if (error) throw toRepositoryError("GroupsRepository.update", error);
    return groupToDomain(data);
  }

  async membersOf(groupId: string): Promise<GroupMember[]> {
    const { data, error } = await getSupabaseAdmin()
      .from("group_members")
      .select("*")
      .eq("group_id", groupId)
      .order("relationship", { ascending: true })
      .order("full_name", { ascending: true });
    if (error) throw toRepositoryError("GroupsRepository.membersOf", error);
    return (data ?? []).map(memberToDomain);
  }

  async addMember(input: NewGroupMember): Promise<GroupMember> {
    const { data, error } = await getSupabaseAdmin()
      .from("group_members")
      .insert({
        group_id: input.groupId,
        client_id: input.clientId ?? null,
        full_name: input.fullName,
        ...(input.relationship !== undefined ? { relationship: input.relationship } : {}),
        ...(input.coverageTier !== undefined ? { coverage_tier: input.coverageTier } : {}),
        ...(input.ecardStatus !== undefined ? { ecard_status: input.ecardStatus } : {}),
        join_date: input.joinDate ?? null,
        ...(input.status !== undefined ? { status: input.status } : {}),
        last_name: input.lastName ?? null,
        first_name: input.firstName ?? null,
        middle_initial: input.middleInitial ?? null,
        gender: input.gender ?? null,
        civil_status: input.civilStatus ?? null,
        nationality: input.nationality ?? null,
        birth_date: input.birthDate ?? null,
        place_of_birth: input.placeOfBirth ?? null,
        effective_date: input.effectiveDate ?? null,
        occupation_grade: input.occupationGrade ?? null,
        room_and_board_plan: input.roomAndBoardPlan ?? null,
        maximum_benefit_limit: input.maximumBenefitLimit ?? null,
        philhealth_member: input.philhealthMember ?? null,
        address: input.address ?? null,
        email: input.email ?? null,
        mobile_number: input.mobileNumber ?? null,
        landline_number: input.landlineNumber ?? null,
        beneficiary_name: input.beneficiaryName ?? null,
        beneficiary_birth_date: input.beneficiaryBirthDate ?? null,
      })
      .select("*")
      .single();
    if (error) throw toRepositoryError("GroupsRepository.addMember", error);
    return memberToDomain(data);
  }

  async issuePendingEcards(groupId: string): Promise<number> {
    const { data, error } = await getSupabaseAdmin()
      .from("group_members")
      .update({ ecard_status: "Issued" })
      .eq("group_id", groupId)
      .eq("ecard_status", "Pending")
      .select("id");
    if (error) throw toRepositoryError("GroupsRepository.issuePendingEcards", error);
    return data?.length ?? 0;
  }
}
