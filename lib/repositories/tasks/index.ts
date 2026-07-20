import type { TasksRepository } from "./tasks.repository";
import { SupabaseTasksRepository } from "./tasks.repository.supabase";

let instance: TasksRepository | null = null;

/** Resolve the Tasks repository (see clients/index.ts for the pattern). */
export function getTasksRepository(): TasksRepository {
  if (!instance) {
    instance = new SupabaseTasksRepository();
  }
  return instance;
}

export type { TasksRepository } from "./tasks.repository";
export type { Task, NewTask, TaskUpdate, TaskTag } from "./task.entity";
export { TASK_TAGS } from "./task.entity";
