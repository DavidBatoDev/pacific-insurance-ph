/** Due-date → board column bucketing shared by the Tasks board, the dashboard
 * widget, and the Add Task drawer preview. */

export type TaskBucket = "overdue" | "today" | "week";

export const BUCKET_LABEL: Record<TaskBucket, string> = {
  overdue: "Overdue",
  today: "Due today",
  week: "Due this week",
};

export const BUCKET_TONE: Record<TaskBucket, "red" | "amber" | "blue"> = {
  overdue: "red",
  today: "amber",
  week: "blue",
};

export function taskBucket(dueDate: string | null): { bucket: TaskBucket; meta: string } {
  if (!dueDate) return { bucket: "week", meta: "No due date" };
  const due = new Date(dueDate + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  if (diff < 0)
    return {
      bucket: "overdue",
      meta: "Due " + due.toLocaleDateString("en-PH", { month: "short", day: "numeric" }),
    };
  if (diff === 0) return { bucket: "today", meta: "Today" };
  if (diff === 1) return { bucket: "week", meta: "Tomorrow" };
  return {
    bucket: "week",
    meta: due.toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric" }),
  };
}

/** Tag → accent tone used across board cards + widget rows. */
export const TAG_TONE: Record<string, string> = {
  Application: "text-blue",
  Documents: "text-amber",
  Renewal: "text-violet",
  Travel: "text-blue",
  Claim: "text-red",
  Relationship: "text-green",
  Commission: "text-green",
  General: "text-slate",
};
