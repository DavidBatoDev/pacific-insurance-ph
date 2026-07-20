import { TasksBoard } from "@/components/hub/screens/tasks-board";
import { getTasksRepository } from "@/lib/repositories/tasks";

export const dynamic = "force-dynamic";

/** Tasks board — wired to the tasks table (shared with the dashboard widget). */
export default async function Page() {
  const tasks = await getTasksRepository().list();
  return <TasksBoard tasks={tasks} />;
}
