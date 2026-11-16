import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

import { recordAudit } from "@/lib/audit/log";
import {
  DEACTIVATED_MESSAGE, GOOGLE_CALLBACK_PATH, GOOGLE_NEXT_COOKIE, googleIdentityProblem,
  NOT_INVITED_MESSAGE, safeRedirectPath,
} from "@/lib/auth/google-sign-in";
import { getUsersRepository } from "@/lib/repositories/users";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Google sign-in landing (PKCE). Supabase signups are off, so an address nobody invited never gets
 * an account; this route additionally requires an agency Workspace identity and a usable CRM row.
 * A rejected session is ended here, before any response, so it never reaches the app.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const cookieStore = await cookies();
  const next = safeRedirectPath(cookieStore.get(GOOGLE_NEXT_COOKIE)?.value);
  cookieStore.delete({ name: GOOGLE_NEXT_COOKIE, path: GOOGLE_CALLBACK_PATH });

  const toLogin = (message: string) => {
    const target = new URL("/login", origin);
    target.searchParams.set("error", message);
    return NextResponse.redirect(target);
  };

  const providerError = searchParams.get("error");
  if (providerError) {
    const detail = `${searchParams.get("error_code") ?? ""} ${searchParams.get("error_description") ?? ""}`;
    return toLogin(/signup/i.test(detail) ? NOT_INVITED_MESSAGE : "Google sign-in was cancelled or failed. Try again.");
  }
  const code = searchParams.get("code");
  if (!code) return toLogin("Google sign-in did not complete. Try again.");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return toLogin("Google sign-in did not complete. Try again.");

  const reject = async (message: string) => {
    // Local scope: only this new session; the person's other signed-in devices are untouched.
    await supabase.auth.signOut({ scope: "local" });
    return toLogin(message);
  };

  const problem = googleIdentityProblem(data.user);
  if (problem) return reject(problem);

  const users = getUsersRepository();
  const user = await users.findById(data.user.id);
  if (!user) return reject(NOT_INVITED_MESSAGE);
  if (user.status === "Inactive") return reject(DEACTIVATED_MESSAGE);
  if (user.status === "Invited") {
    // Google is the credential (DJ5): no password is set, the invitation is accepted here.
    const activatedAt = new Date().toISOString();
    await users.update(user.id, { status: "Active", activatedAt });
    await recordAudit({ actorId: user.id, action: "activate", tableName: "users", recordId: user.id, newValue: { status: "Active", activated_at: activatedAt, method: "google" } });
  }

  return NextResponse.redirect(new URL(next, origin));
}
