import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { GMAIL_CALLBACK_PATH, getGmailConfig, gmailConfigurationProblem } from "./config";

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("GOOGLE_CLIENT_ID", "synthetic-client.apps.googleusercontent.com");
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "synthetic-client-secret");
  vi.stubEnv("GOOGLE_REDIRECT_URI", `http://localhost:3000${GMAIL_CALLBACK_PATH}`);
  vi.stubEnv("GMAIL_SENDER_EMAIL", "admin@pacificinsuranceph.com");
  vi.stubEnv("GMAIL_TOKEN_ENCRYPTION_KEY", Buffer.alloc(32, 1).toString("base64"));
});

afterEach(() => vi.unstubAllEnvs());

describe("lazy server-only Gmail configuration", () => {
  it("accepts local development and normalizes only the approved sender", () => {
    vi.stubEnv("GMAIL_SENDER_EMAIL", " Admin@PacificInsurancePH.com ");
    expect(getGmailConfig().senderEmail).toBe("admin@pacificinsuranceph.com");
    expect(getGmailConfig().encryptionKey.length).toBe(32);
    expect(gmailConfigurationProblem()).toBeNull();
  });

  it.each(["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REDIRECT_URI", "GMAIL_SENDER_EMAIL", "GMAIL_TOKEN_ENCRYPTION_KEY"])("fails safely on missing %s at access time", (name) => {
    vi.stubEnv(name, "");
    expect(() => getGmailConfig()).toThrow(Error);
  });

  it.each([
    "not-a-url",
    "http://example.test/api/integrations/gmail/callback",
    "http://127.0.0.1:3000/api/integrations/gmail/callback",
    "https://example.test/wrong-callback",
    "https://example.test/api/integrations/gmail/callback?code=SECRET",
    "https://example.test/api/integrations/gmail/callback?",
    "https://example.test/api/integrations/gmail/callback#SECRET",
    "https://example.test/api/integrations/gmail/callback#",
    "https://user:SECRET@example.test/api/integrations/gmail/callback",
    "https://@example.test/api/integrations/gmail/callback",
  ])("rejects non-fixed or unsafe callbacks without echoing values: %s", (uri) => {
    vi.stubEnv("GOOGLE_REDIRECT_URI", uri);
    expect(() => getGmailConfig()).toThrow();
    expect(gmailConfigurationProblem()).not.toContain("SECRET");
    expect(gmailConfigurationProblem()).not.toContain(uri);
  });

  it("requires HTTPS even for localhost in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(() => getGmailConfig()).toThrow(Error);
    vi.stubEnv("GOOGLE_REDIRECT_URI", `https://app.example.test${GMAIL_CALLBACK_PATH}`);
    expect(gmailConfigurationProblem()).toBeNull();
  });

  it("rejects a different configured mailbox without returning that address", () => {
    vi.stubEnv("GMAIL_SENDER_EMAIL", "private@other.test");
    expect(() => getGmailConfig()).toThrow(Error);
    expect(gmailConfigurationProblem()).not.toContain("private@other.test");
  });

  it.each([
    "not-base64",
    Buffer.alloc(31).toString("base64"),
    Buffer.alloc(33).toString("base64"),
    Buffer.alloc(32).toString("base64").replace(/=+$/, ""),
    `${Buffer.alloc(32).toString("base64")}!`,
  ])("rejects malformed or incorrectly sized encryption keys", (key) => {
    vi.stubEnv("GMAIL_TOKEN_ENCRYPTION_KEY", key);
    expect(() => getGmailConfig()).toThrow(Error);
    expect(gmailConfigurationProblem()).not.toContain(key);
  });
});
