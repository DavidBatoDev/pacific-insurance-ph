import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { vi } from "vitest";

vi.mock("server-only", () => ({}));

import { GmailSendError, sendGmailMessage } from "./send-api";

const access = { accessToken: "synthetic-token", googleSubject: "subject1", oauthClientId: "client1" };
type Handler = (request: IncomingMessage, body: Buffer, response: ServerResponse) => void;

let server: Server;
let base = "";
let handler: Handler;
const received: { method?: string; url?: string; authorization?: string; body: Buffer }[] = [];

beforeEach(async () => {
  received.length = 0;
  server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {
      const body = Buffer.concat(chunks);
      received.push({ method: request.method, url: request.url, authorization: request.headers.authorization, body });
      handler(request, body, response);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterEach(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

/** Routes the fixed Gmail URL to the local simulator while keeping real HTTP semantics. */
const simulator: typeof fetch = (input, init) => {
  const url = new URL(String(input));
  expect(url.href).toBe("https://gmail.googleapis.com/gmail/v1/users/me/messages/send");
  return fetch(`${base}${url.pathname}`, init);
};

const raw = Buffer.from("From: a@b\r\nTo: c@d\r\nSubject: Hi\r\n\r\nBody ✓", "utf8");

describe("sendGmailMessage", () => {
  it("posts the raw message once as base64url with the thread and returns provider IDs", async () => {
    handler = (_request, _body, response) => { response.writeHead(200, { "Content-Type": "application/json" }); response.end(JSON.stringify({ id: "msg1", threadId: "thr1", labelIds: ["SENT"] })); };
    await expect(sendGmailMessage({ raw, threadId: "thr1" }, access, simulator)).resolves.toEqual({ gmailMessageId: "msg1", gmailThreadId: "thr1" });
    expect(received).toHaveLength(1);
    expect(received[0].method).toBe("POST");
    expect(received[0].authorization).toBe("Bearer synthetic-token");
    const payload = JSON.parse(received[0].body.toString("utf8"));
    expect(Buffer.from(payload.raw, "base64url").equals(raw)).toBe(true);
    expect(payload.threadId).toBe("thr1");
  });

  it.each([400, 403, 404, 413, 422, 429])("treats a complete %i response as a proven rejection without retrying", async (status) => {
    handler = (_request, _body, response) => { response.writeHead(status); response.end("{\"error\":{\"message\":\"private provider text\"}}"); };
    const error = await sendGmailMessage({ raw }, access, simulator).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(GmailSendError);
    expect(error).toMatchObject({ outcome: "failed", code: "gmail_send_rejected", httpStatus: status });
    expect(String((error as Error).message)).not.toContain("private provider text");
    expect(received).toHaveLength(1);
  });

  it("marks 401 as an auth rejection", async () => {
    handler = (_request, _body, response) => { response.writeHead(401); response.end(); };
    await expect(sendGmailMessage({ raw }, access, simulator)).rejects.toMatchObject({ outcome: "failed", code: "gmail_send_auth_required", httpStatus: 401 });
    expect(received).toHaveLength(1);
  });

  it.each([408, 500, 502, 503])("treats %i as an unknown outcome, never a failure", async (status) => {
    handler = (_request, _body, response) => { response.writeHead(status); response.end(); };
    await expect(sendGmailMessage({ raw }, access, simulator)).rejects.toMatchObject({ outcome: "unknown", code: "gmail_send_unknown" });
    expect(received).toHaveLength(1);
  });

  it("treats a request received and then a dropped connection as unknown", async () => {
    handler = (request) => { request.socket.destroy(); };
    await expect(sendGmailMessage({ raw }, access, simulator)).rejects.toMatchObject({ outcome: "unknown" });
    expect(received).toHaveLength(1);
  });

  it.each([
    ["truncated JSON", "{\"id\":\"msg1\",\"thre"],
    ["missing thread", JSON.stringify({ id: "msg1" })],
    ["invalid ID", JSON.stringify({ id: "../x", threadId: "t" })],
  ])("treats a 200 with %s as unknown", async (_label, body) => {
    handler = (_request, _body, response) => { response.writeHead(200, { "Content-Type": "application/json" }); response.end(body); };
    await expect(sendGmailMessage({ raw }, access, simulator)).rejects.toMatchObject({ outcome: "unknown", code: "gmail_send_invalid_response" });
  });

  it("bounds a success body to 64 KiB and reports unknown", async () => {
    handler = (_request, _body, response) => { response.writeHead(200); response.end(`{"id":"m","threadId":"t","pad":"${"x".repeat(70 * 1024)}"}`); };
    await expect(sendGmailMessage({ raw }, access, simulator)).rejects.toMatchObject({ outcome: "unknown", code: "gmail_send_invalid_response" });
  });

  it("rejects redirects instead of following them", async () => {
    handler = (_request, _body, response) => { response.writeHead(302, { Location: "https://evil.test/" }); response.end(); };
    await expect(sendGmailMessage({ raw }, access, simulator)).rejects.toMatchObject({ outcome: "unknown" });
    expect(received).toHaveLength(1);
  });
});
