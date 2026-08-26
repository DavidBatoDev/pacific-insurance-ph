"use client";

import { useRouter } from "next/navigation";

import { SCREEN_PATH, type ScreenId } from "./shell";

/**
 * Router-backed navigation shim. Lets screens keep their `setScreen(id)`
 * call sites while navigation happens via real routes.
 */
export function useScreenNav() {
  const router = useRouter();
  return (s: ScreenId) => router.push(SCREEN_PATH[s]);
}

/**
 * Parameterized record navigation (design events open-contact / open-group).
 * Contacts and groups are dynamic routes, so they get helpers rather than
 * SCREEN_PATH entries — keeping the Record<ScreenId, string> contract intact.
 */
export function useRecordNav() {
  const router = useRouter();
  return {
    openContact: (clientId: string, from?: "prospects") =>
      router.push(`/clients/${clientId}${from === "prospects" ? "?from=prospects" : ""}`),
    openGroup: (groupId: string) => router.push(`/group/${groupId}`),
  };
}
