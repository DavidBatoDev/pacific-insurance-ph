import { redirect } from "next/navigation";

import { AppShell } from "@/components/hub/app-shell";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getShellStats } from "@/lib/queries/shell";

/** Authenticated app layout: resolves the staff user and renders the shell. */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const shellStats = await getShellStats();

  return (
    <AppShell userName={user.fullName} userRole={user.role} shellStats={shellStats}>
      {children}
    </AppShell>
  );
}
