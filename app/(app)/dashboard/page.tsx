import { Dashboard } from "@/components/hub/dashboard";
import { getTasksRepository } from "@/lib/repositories/tasks";

export const dynamic = "force-dynamic";

/** Dashboard — tasks widget wired to the tasks table; other widgets are still draft. */
export default async function Page() {
  const tasks = await getTasksRepository().list();
  return <Dashboard tasks={tasks} />;
}
