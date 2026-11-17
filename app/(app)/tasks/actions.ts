"use server";

import { revalidatePath } from "next/cache";

import { getActor, type ActionResult } from "@/lib/actions/context";
import { recordActivity } from "@/lib/activity/log";
import { recordAudit } from "@/lib/audit/log";
import { assertRecordAccess } from "@/lib/auth/agent-scope";
import { taskLinkOptionsForClient, type TaskLinkOption } from "@/lib/queries/task-links";
import { getTasksRepository, type NewTask, type Task } from "@/lib/repositories/tasks";
import { getUsersRepository } from "@/lib/repositories/users";
import type { Json } from "@/lib/supabase/types";

export interface AssignableUser {
  id: string;
  name: string;
}

/** Users the Add Task drawer can assign to. */
export async function listAssignableUsersAction(): Promise<AssignableUser[]> {
  const { rows } = await getUsersRepository().list({ limit: 50 });
  return rows.map((u) => ({ id: u.id, name: u.fullName }));
}

/** Records under a contact the task can attach to. */
export async function taskLinkOptionsAction(clientId: string): Promise<TaskLinkOption[]> {
  await assertRecordAccess("client", clientId);
  return taskLinkOptionsForClient(clientId);
}

export async function createTaskAction(input: NewTask): Promise<ActionResult<Task>> {
  const actor = await getActor();
  if (!input.title?.trim()) return { ok: false, error: "Task title is required." };
  if (!input.dueDate) return { ok: false, error: "Due date is required." };

  try {
    // Agents may only attach a task to their own client and that book's records.
    await Promise.all(
      ([
        ["client", input.clientId],
        ["application", input.applicationId],
        ["policy", input.policyId],
        ["renewal", input.renewalId],
        ["claim", input.claimId],
        ["travel", input.travelRequestId],
      ] as const)
        .filter(([, id]) => !!id)
        .map(([kind, id]) => assertRecordAccess(kind, id)),
    );
    const created = await getTasksRepository().create({
      ...input,
      title: input.title.trim(),
      assignedUserId: input.assignedUserId ?? actor.id,
    });
    await recordAudit({
      actorId: actor.id,
      action: "create",
      tableName: "tasks",
      recordId: created.id,
      newValue: created as unknown as Json,
    });
    revalidatePath("/tasks");
    revalidatePath("/dashboard");
    return { ok: true, data: created };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to create task." };
  }
}

/** Check a task off (or back on). Completing a linked task logs to the contact timeline. */
export async function toggleTaskAction(id: string): Promise<ActionResult<Task>> {
  const actor = await getActor();
  try {
    await assertRecordAccess("task", id);
    const repo = getTasksRepository();
    const existing = await repo.findById(id);
    if (!existing) return { ok: false, error: "Task not found." };

    const completing = !existing.done;
    const updated = await repo.update(id, {
      status: completing ? "Completed" : "Open",
      completedDate: completing ? new Date().toISOString().slice(0, 10) : null,
    });

    if (completing && existing.clientId) {
      await recordActivity({
        scopeType: "client",
        scopeId: existing.clientId,
        activityType: "task.completed",
        summary: `Task completed — ${existing.title}`,
        actorId: actor.id,
        metadata: existing.linkedRecordRef
          ? ({ linkedRecord: existing.linkedRecordRef } as Json)
          : undefined,
      });
    }

    revalidatePath("/tasks");
    revalidatePath("/dashboard");
    return { ok: true, data: updated };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to update task." };
  }
}
