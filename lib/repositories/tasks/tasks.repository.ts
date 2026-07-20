import type { Task, NewTask, TaskUpdate } from "./task.entity";

/** The Tasks repository port (same shape as ClientsRepository). */
export interface TasksRepository {
  findById(id: string): Promise<Task | null>;
  /** All tasks, joined with client + assignee names; newest first. */
  list(params?: { clientId?: string; includeCompleted?: boolean }): Promise<Task[]>;
  create(input: NewTask): Promise<Task>;
  update(id: string, input: TaskUpdate): Promise<Task>;
  delete(id: string): Promise<void>;
}
