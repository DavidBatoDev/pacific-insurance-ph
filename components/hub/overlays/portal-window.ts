"use client";

const FEATURES = "popup,width=1200,height=860";

/**
 * Open a carrier portal in a sized pop-up beside the app. Neither Pacific Cross
 * portal can be embedded: the Travel portal sends X-Frame-Options: DENY and the
 * proposal portal's session cookies are SameSite=Lax.
 *
 * Call without a url synchronously in a click handler to reserve the window
 * before an await (pop-up blockers only allow opens tied to the gesture), then
 * set `location.href` once the url is known.
 */
export function openPortalWindow(url?: string, name = "pacific-cross-portal"): Window | null {
  const win = window.open(url ?? "about:blank", name, FEATURES);
  // `noopener` would hide the handle we need; clearing opener gives the same isolation.
  try {
    if (win) win.opener = null;
  } catch {
    // Already navigated cross-origin; the portal sets its own opener policy.
  }
  return win;
}
