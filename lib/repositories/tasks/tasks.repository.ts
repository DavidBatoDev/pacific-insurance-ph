import type { Task, NewTask, TaskUpdate } from "./task.entity";

/** The Tasks repository port (same shape as ClientsRepository). */
export interface TasksRepository {
  findById(id: string): Promise<Task | null>;
  /**
   * All tasks, joined with client + assignee names; soonest due first. `ownerUserId` (Phase J9 agent
   * scope) keeps tasks assigned to that user or on a client assigned to them.
   */
  list(params?: { clientId?: string; includeCompleted?: boolean; limit?: number; ownerUserId?: string | null }): Promise<Task[]>;
  create(input: NewTask): Promise<Task>;
  update(id: string, input: TaskUpdate): Promise<Task>;
  delete(id: string): Promise<void>;
}
