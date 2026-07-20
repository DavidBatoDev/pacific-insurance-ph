/**
 * Domain types for a Task — the shared store behind the Tasks board and the
 * Dashboard "My tasks" widget (design add-task.jsx / new-modals.md §10).
 */

/** Design tag taxonomy (task_type column). */
export const TASK_TAGS = [
  "Application",
  "Documents",
  "Renewal",
  "Travel",
  "Claim",
  "Relationship",
  "Commission",
  "General",
] as const;
export type TaskTag = (typeof TASK_TAGS)[number];

export interface Task {
  id: string;
  referenceNo: string | null;
  title: string;
  /** task_type — design tag or a legacy workflow value. */
  tag: string;
  clientId: string | null;
  /** Joined convenience: linked client's full name. */
  clientName: string | null;
  applicationId: string | null;
  policyId: string | null;
  renewalId: string | null;
  claimId: string | null;
  travelRequestId: string | null;
  /** Joined convenience: reference number of the linked record, if any. */
  linkedRecordRef: string | null;
  assignedUserId: string | null;
  /** Joined convenience: assignee's full name. */
  assigneeName: string | null;
  dueDate: string | null;
  priority: string;
  status: string;
  done: boolean;
  completedDate: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NewTask {
  title: string;
  tag: string;
  clientId?: string | null;
  applicationId?: string | null;
  policyId?: string | null;
  renewalId?: string | null;
  claimId?: string | null;
  travelRequestId?: string | null;
  assignedUserId?: string | null;
  dueDate?: string | null;
  priority?: string;
  notes?: string | null;
}

export interface TaskUpdate {
  title?: string;
  tag?: string;
  assignedUserId?: string | null;
  dueDate?: string | null;
  priority?: string;
  status?: string;
  completedDate?: string | null;
  notes?: string | null;
}
