import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/current-user";

import { SetPasswordForm } from "./set-password-form";

/** Invitation landing: the invitee chooses their own password, which activates the account. */
export default async function SetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ error }, user] = await Promise.all([searchParams, getCurrentUser()]);
  if (!user) redirect("/login");
  if (user.status === "Inactive") redirect("/auth/signout?reason=deactivated");
  const activating = user.status === "Invited";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-8 shadow-lg">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-bold tracking-tight">Pacific Insurance PH</h1>
          <p className="text-subtle text-sm">
            {activating ? `Welcome, ${user.fullName}. Choose a password to activate your account.` : "Choose a new password."}
          </p>
          <p className="mt-2 font-mono text-xs text-muted-foreground">{user.email}</p>
        </div>

        <SetPasswordForm submitLabel={activating ? "Activate account" : "Save password"} serverError={error ?? null} />
      </div>
    </div>
  );
}
