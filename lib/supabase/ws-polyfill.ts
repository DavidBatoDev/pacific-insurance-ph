import "server-only";

import WebSocket from "ws";

/**
 * supabase-js (realtime-js) requires a global `WebSocket` constructor when a
 * client is created — even though this app never opens a realtime channel.
 * Node < 22 has no global WebSocket, so provide one from the `ws` package.
 *
 * No-op on Node 22+ and on the edge runtime, where `WebSocket` already exists.
 * Imported for its side effect at the top of the server Supabase clients.
 */
const g = globalThis as typeof globalThis & { WebSocket?: unknown };
if (typeof g.WebSocket === "undefined") {
  g.WebSocket = WebSocket as unknown as typeof g.WebSocket;
}
