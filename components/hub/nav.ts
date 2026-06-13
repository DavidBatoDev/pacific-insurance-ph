"use client";

import { useRouter } from "next/navigation";

import { SCREEN_PATH, type ScreenId } from "./shell";

/**
 * Router-backed navigation shim. Lets the (still mock) screens keep their
 * `setScreen(id)` call sites while navigation now happens via real routes.
 */
export function useScreenNav() {
  const router = useRouter();
  return (s: ScreenId) => router.push(SCREEN_PATH[s]);
}
