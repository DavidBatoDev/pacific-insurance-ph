import "server-only";

import { getCurrentUser } from "@/lib/auth/current-user";

/** Standard return shape for Server Actions. */
export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export interface Actor {
  id: string;
  fullName: string;
  role: string;
}

/**
 * Resolve the acting staff user for a mutating Server Action. Throws if the
 * request is not authenticated — callers run inside the auth-gated app, so this
 * should only happen on a genuinely missing session.
 */
export async function getActor(): Promise<Actor> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Not authenticated");
  }
  return { id: user.id, fullName: user.fullName, role: user.role };
}
