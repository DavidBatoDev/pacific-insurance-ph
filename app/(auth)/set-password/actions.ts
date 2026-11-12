"use server";

import { redirect } from "next/navigation";

import { recordAudit } from "@/lib/audit/log";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getUsersRepository } from "@/lib/repositories/users";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { PASSWORD_MIN_LENGTH } from "./password-policy";

/**
 * Sets the signed-in user's password. For an `Invited` account this is the activation step:
 * the users row becomes `Active` only after Supabase accepted the new password.
 */
export async function setPasswordAction(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.status === "Inactive") redirect("/auth/signout?reason=deactivated");

  const fail = (message: string) => redirect(`/set-password?error=${encodeURIComponent(message)}`);
  if (password.length < PASSWORD_MIN_LENGTH) fail(`Use at least ${PASSWORD_MIN_LENGTH} characters.`);
  if (password !== confirm) fail("The two passwords don't match.");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) fail(error.message);

  if (user.status === "Invited") {
    const activatedAt = new Date().toISOString();
    await getUsersRepository().update(user.id, { status: "Active", activatedAt });
    await recordAudit({ actorId: user.id, action: "activate", tableName: "users", recordId: user.id, newValue: { status: "Active", activated_at: activatedAt } });
  }

  redirect("/dashboard");
}
