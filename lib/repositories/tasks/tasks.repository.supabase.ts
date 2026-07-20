import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";
import { toRepositoryError } from "../types";
import type { Task, NewTask, TaskUpdate } from "./task.entity";
import type { TasksRepository } from "./tasks.repository";

type TaskRow = Database["public"]["Tables"]["tasks"]["Row"];
type TaskPatch = Database["public"]["Tables"]["tasks"]["Update"];

/** Row plus the joined display names/refs the board renders. */
type JoinedRow = TaskRow & {
  clients: { first_name: string; last_name: string } | null;
  assigned_user: { full_name: string } | null;
  applications: { reference_no: string | null } | null;
  policies: { reference_no: string | null } | null;
  renewals: { reference_no: string | null } | null;
  claims: { reference_no: string | null } | null;
  travel_requests: { reference_no: string | null } | null;
};

const SELECT = `*,
  clients (first_name, last_name),
  assigned_user:users (full_name),
  applications (reference_no),
  policies (reference_no),
  renewals (reference_no),
  claims (reference_no),
  travel_requests (reference_no)`;

function toDomain(row: JoinedRow): Task {
  const linkedRecordRef =
    row.applications?.reference_no ??
    row.policies?.reference_no ??
    row.renewals?.reference_no ??
    row.claims?.reference_no ??
    row.travel_requests?.reference_no ??
    null;
  return {
    id: row.id,
    referenceNo: row.reference_no,
    title: row.title,
    tag: row.task_type ?? "General",
    clientId: row.client_id,
    clientName: row.clients
      ? [row.clients.first_name, row.clients.last_name].filter(Boolean).join(" ")
      : null,
    applicationId: row.application_id,
    policyId: row.policy_id,
    renewalId: row.renewal_id,
    claimId: row.claim_id,
    travelRequestId: row.travel_request_id,
    linkedRecordRef,
    assignedUserId: row.assigned_user_id,
    assigneeName: row.assigned_user?.full_name ?? null,
    dueDate: row.due_date,
    priority: row.priority ?? "Normal",
    status: row.status,
    done: row.status === "Completed",
    completedDate: row.completed_date,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** supabase-js (service role) implementation of {@link TasksRepository}. */
export class SupabaseTasksRepository implements TasksRepository {
  async findById(id: string): Promise<Task | null> {
    const { data, error } = await getSupabaseAdmin()
      .from("tasks")
      .select(SELECT)
      .eq("id", id)
      .maybeSingle<JoinedRow>();

    if (error) throw toRepositoryError("TasksRepository.findById", error);
    return data ? toDomain(data) : null;
  }

  async list(params: { clientId?: string; includeCompleted?: boolean } = {}): Promise<Task[]> {
    let query = getSupabaseAdmin()
      .from("tasks")
      .select(SELECT)
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });
    if (params.clientId) query = query.eq("client_id", params.clientId);
    if (!params.includeCompleted) query = query.neq("status", "Cancelled");

    const { data, error } = await query.returns<JoinedRow[]>();
    if (error) throw toRepositoryError("TasksRepository.list", error);
    return (data ?? []).map(toDomain);
  }

  async create(input: NewTask): Promise<Task> {
    const { data, error } = await getSupabaseAdmin()
      .from("tasks")
      .insert({
        title: input.title,
        task_type: input.tag,
        client_id: input.clientId ?? null,
        application_id: input.applicationId ?? null,
        policy_id: input.policyId ?? null,
        renewal_id: input.renewalId ?? null,
        claim_id: input.claimId ?? null,
        travel_request_id: input.travelRequestId ?? null,
        assigned_user_id: input.assignedUserId ?? null,
        due_date: input.dueDate ?? null,
        priority: input.priority ?? "Normal",
        notes: input.notes ?? null,
      })
      .select(SELECT)
      .single<JoinedRow>();

    if (error) throw toRepositoryError("TasksRepository.create", error);
    return toDomain(data);
  }

  async update(id: string, input: TaskUpdate): Promise<Task> {
    const patch: TaskPatch = {};
    if (input.title !== undefined) patch.title = input.title;
    if (input.tag !== undefined) patch.task_type = input.tag;
    if (input.assignedUserId !== undefined) patch.assigned_user_id = input.assignedUserId;
    if (input.dueDate !== undefined) patch.due_date = input.dueDate;
    if (input.priority !== undefined) patch.priority = input.priority;
    if (input.status !== undefined) patch.status = input.status;
    if (input.completedDate !== undefined) patch.completed_date = input.completedDate;
    if (input.notes !== undefined) patch.notes = input.notes;

    const { data, error } = await getSupabaseAdmin()
      .from("tasks")
      .update(patch)
      .eq("id", id)
      .select(SELECT)
      .single<JoinedRow>();

    if (error) throw toRepositoryError("TasksRepository.update", error);
    return toDomain(data);
  }

  async delete(id: string): Promise<void> {
    const { error } = await getSupabaseAdmin().from("tasks").delete().eq("id", id);
    if (error) throw toRepositoryError("TasksRepository.delete", error);
  }
}
