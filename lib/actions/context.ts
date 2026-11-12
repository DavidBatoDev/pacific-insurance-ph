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
 * request is not authenticated or the account is not Active (invited accounts
 * have not finished activation; deactivated ones keep no write access).
 */
export async function getActor(): Promise<Actor> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Not authenticated");
  }
  if (user.status !== "Active") {
    throw new Error("An active account is required.");
  }
  return { id: user.id, fullName: user.fullName, role: user.role };
}
