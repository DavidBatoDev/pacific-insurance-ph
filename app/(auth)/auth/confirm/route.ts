import { NextResponse, type NextRequest } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Landing for staff invitation links. Verifies the hashed token server-side (cookie session,
 * no implicit-flow fragment) and sends the invitee to set their password. The proxy lets this
 * path through unauthenticated; everything else still requires a session.
 */
export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  const origin = request.nextUrl.origin;

  if (!tokenHash || type !== "invite") {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent("This invitation link is incomplete. Ask the inviter to resend it.")}`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.verifyOtp({ type: "invite", token_hash: tokenHash });
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent("This invitation link is invalid or has expired. Ask the inviter to resend it.")}`);
  }

  return NextResponse.redirect(`${origin}/set-password`);
}
