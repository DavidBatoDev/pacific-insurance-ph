"use server";

import { redirect } from "next/navigation";

import { getUsersRepository } from "@/lib/repositories/users";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const DEACTIVATED_MESSAGE = "This account has been deactivated. Contact the Owner if you need access restored.";

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const requested = String(formData.get("redirectTo") ?? "/dashboard");
  const redirectTo = requested.startsWith("/") ? requested : "/dashboard";

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(
      `/login?error=${encodeURIComponent(error.message)}&redirectTo=${encodeURIComponent(redirectTo)}`,
    );
  }

  // Auth accepted the password; the CRM row decides whether the account may still be used.
  const user = await getUsersRepository().findById(data.user.id);
  if (!user || user.status === "Inactive") {
    await supabase.auth.signOut();
    redirect(`/login?error=${encodeURIComponent(DEACTIVATED_MESSAGE)}`);
  }
  if (user.status === "Invited") redirect("/set-password");

  redirect(redirectTo);
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
