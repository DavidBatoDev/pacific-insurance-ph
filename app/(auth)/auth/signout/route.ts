import { NextResponse, type NextRequest } from "next/server";

import { DEACTIVATED_MESSAGE } from "@/lib/auth/google-sign-in";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const REASONS: Record<string, string> = {
  deactivated: DEACTIVATED_MESSAGE,
};

/**
 * Ends the session of an account that may no longer use the app (deactivated while signed in).
 * Server Components cannot clear cookies, so the app layout redirects here instead.
 */
export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  const reason = request.nextUrl.searchParams.get("reason") ?? "";
  const message = REASONS[reason];
  const target = new URL("/login", request.nextUrl.origin);
  if (message) target.searchParams.set("error", message);
  return NextResponse.redirect(target);
}
