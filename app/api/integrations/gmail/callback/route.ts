import { cookies } from "next/headers";

import { getCurrentUser } from "@/lib/auth/current-user";
import { toAppRole } from "@/lib/auth/permissions";
import { recordAudit } from "@/lib/audit/log";
import { GMAIL_BROWSER_COOKIE, GMAIL_CALLBACK_PATH, gmailConfigurationProblem } from "@/lib/gmail/config";
import { completeGmailConnection } from "@/lib/gmail/connection";
import { classifyGoogleError } from "@/lib/gmail/policy";
import { GMAIL_CALLBACK_MESSAGES } from "@/lib/gmail/types";

export const runtime = "nodejs";
export const maxDuration = 60;

/** No provider values or authorization query are ever forwarded to another page. */
export async function GET(request: Request) {
  const cookieStore = await cookies();
  const browserBinding = cookieStore.get(GMAIL_BROWSER_COOKIE)?.value;
  const secure = new URL(request.url).protocol === "https:";
  cookieStore.set(GMAIL_BROWSER_COOKIE, "", {
    httpOnly: true, sameSite: "lax", secure, path: GMAIL_CALLBACK_PATH, maxAge: 0,
  });
  const responseHeaders = {
    "Cache-Control": "private, no-store",
    "Referrer-Policy": "no-referrer",
  };
  let result = "failed";
  try {
    const actor = await getCurrentUser();
    if (!actor) {
      return new Response(null, { status: 303, headers: { ...responseHeaders, Location: "/login?redirectTo=%2Fsettings" } });
    }
    if (actor.status !== "Active" || toAppRole(actor.role) !== "admin") {
      result = "forbidden";
    } else if (gmailConfigurationProblem()) {
      result = "setup_error";
    } else {
      const params = new URL(request.url).searchParams;
      const repeated = ["state", "code", "error"].some((key) => params.getAll(key).length > 1);
      const state = params.get("state");
      const code = params.get("code");
      const error = params.get("error");
      if (request.url.length > 16_384 || repeated || !state || !/^[A-Za-z0-9_-]{43}$/.test(state)
        || !browserBinding || !/^[A-Za-z0-9_-]{43}$/.test(browserBinding)
        || (Boolean(code) === Boolean(error)) || (code?.length ?? 0) > 4096 || (error?.length ?? 0) > 256) {
        result = "invalid_attempt";
      } else {
        result = await completeGmailConnection({ actorId: actor.id, state, browserBinding, code, denied: Boolean(error) });
      }
      if (result !== "connected") {
        await recordAudit({ actorId: actor.id, action: "gmail.connection_not_completed", tableName: "gmail_connections", newValue: { result } });
      }
    }
  } catch (error) {
    const safe = classifyGoogleError(error);
    result = Object.hasOwn(GMAIL_CALLBACK_MESSAGES, safe.code) ? safe.code : "failed";
  }
  const allowedResult = Object.hasOwn(GMAIL_CALLBACK_MESSAGES, result) ? result : "failed";
  return new Response(null, {
    status: 303,
    headers: { ...responseHeaders, Location: `/settings?tab=Integrations&gmail=${allowedResult}` },
  });
}
