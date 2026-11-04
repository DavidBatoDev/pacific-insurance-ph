import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { env } from "@/lib/env";

/**
 * Proxy (Next.js 16's renamed Middleware). Refreshes the Supabase session cookie
 * on every navigation and gates the app: unauthenticated users are sent to /login.
 *
 * This is an optimistic check only — pages/actions still resolve the real user.
 */
export async function proxy(request: NextRequest) {
  // These exact endpoints authenticate with server-only cron/OIDC credentials.
  if (["/api/cron/renewals", "/api/cron/gmail", "/api/integrations/gmail/notifications"].includes(request.nextUrl.pathname)) return NextResponse.next();
  // The callback checks the real CRM session itself and never forwards OAuth codes to login.
  if (request.nextUrl.pathname === "/api/integrations/gmail/callback") return NextResponse.next();
  // Freshness resolves the active CRM account itself; expired sessions need JSON, not login HTML.
  if (request.nextUrl.pathname === "/api/inbox/freshness") return NextResponse.next();

  let response = NextResponse.next({ request });

  const supabase = createServerClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // getClaims verifies the ES256 JWT locally against the cached JWKS —
  // no GoTrue round trip per request (unlike getUser) — and still refreshes
  // an expired session cookie.
  const {
    data,
  } = await supabase.auth.getClaims();
  const user = data?.claims ?? null;

  const { pathname } = request.nextUrl;
  const isLogin = pathname === "/login" || pathname.startsWith("/login/");

  if (!user && !isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(url);
  }

  if (user && isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Run on everything except Next internals and static asset files.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
