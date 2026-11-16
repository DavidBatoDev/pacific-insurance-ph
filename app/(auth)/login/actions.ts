"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  DEACTIVATED_MESSAGE, GOOGLE_CALLBACK_PATH, GOOGLE_NEXT_COOKIE, GOOGLE_WORKSPACE_DOMAIN, safeRedirectPath,
} from "@/lib/auth/google-sign-in";
import { env } from "@/lib/env";
import { getUsersRepository } from "@/lib/repositories/users";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

/**
 * Starts Google sign-in (PKCE; Supabase stores the verifier cookie). The callback returns to the
 * origin the person is using; Supabase's redirect allow-list rejects any origin not configured.
 */
export async function signInWithGoogle(formData: FormData) {
  const next = safeRedirectPath(formData.get("redirectTo"));
  const requestOrigin = (await headers()).get("origin");
  const origin = requestOrigin && /^https?:\/\/[^/]+$/.test(requestOrigin) ? requestOrigin : env.APP_URL;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}${GOOGLE_CALLBACK_PATH}`,
      queryParams: { hd: GOOGLE_WORKSPACE_DOMAIN, prompt: "select_account" },
      skipBrowserRedirect: true,
    },
  });
  if (error || !data.url) redirect(`/login?error=${encodeURIComponent("Google sign-in is unavailable right now. Use your password or try again.")}`);

  (await cookies()).set(GOOGLE_NEXT_COOKIE, next, {
    httpOnly: true, sameSite: "lax", secure: origin.startsWith("https://"), path: GOOGLE_CALLBACK_PATH, maxAge: 600,
  });
  redirect(data.url);
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
