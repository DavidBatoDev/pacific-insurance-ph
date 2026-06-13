import "server-only";

import { cache } from "react";

import { getUsersRepository, type User } from "@/lib/repositories/users";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * The authenticated staff user for the current request, or null.
 *
 * Resolves the Supabase Auth session, then loads the matching `public.users`
 * row (role, name). Wrapped in React `cache` so multiple callers in one request
 * share a single lookup.
 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;
  return getUsersRepository().findById(user.id);
});
