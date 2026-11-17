import { TasksBoard } from "@/components/hub/screens/tasks-board";
import { getAgentScope } from "@/lib/auth/agent-scope";
import { getTasksRepository } from "@/lib/repositories/tasks";

export const dynamic = "force-dynamic";

/** Tasks board — wired to the tasks table (shared with the dashboard widget). */
export default async function Page() {
  const tasks = await getTasksRepository().list({ ownerUserId: await getAgentScope() });
  return <TasksBoard tasks={tasks} />;
}
