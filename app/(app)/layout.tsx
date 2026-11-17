import { redirect } from "next/navigation";

import { AppShell } from "@/components/hub/app-shell";
import { toAppRole } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getShellStats } from "@/lib/queries/shell";

/**
 * Authenticated app layout: resolves the staff user and renders the shell. Invited accounts
 * finish activation first; deactivated ones are signed out (cookies cannot be cleared here).
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.status === "Invited") redirect("/set-password");
  if (user.status !== "Active") redirect("/auth/signout?reason=deactivated");
  // Badges count only an Agent's own book (Phase J9).
  const shellStats = await getShellStats(toAppRole(user.role) === "agent" ? user.id : null);

  return (
    <AppShell userName={user.fullName} userRole={user.role} shellStats={shellStats}>
      {children}
    </AppShell>
  );
}
