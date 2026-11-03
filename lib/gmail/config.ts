import "server-only";
import { GMAIL_READ_SCOPE } from "./policy";

export const GMAIL_CALLBACK_PATH = "/api/integrations/gmail/callback";
export const GMAIL_BROWSER_COOKIE = "gmail_oauth_browser";
export const GMAIL_SCOPES = [
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/gmail.send",
  GMAIL_READ_SCOPE,
];

export interface GmailConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  senderEmail: string;
  encryptionKey: Buffer;
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Gmail setup requires ${name}.`);
  return value;
}

/** Read on demand only: importing Gmail modules must not require deployment secrets. */
export function getGmailConfig(): GmailConfig {
  const clientId = required("GOOGLE_CLIENT_ID");
  const clientSecret = required("GOOGLE_CLIENT_SECRET");
  const redirectUri = required("GOOGLE_REDIRECT_URI");
  const senderEmail = required("GMAIL_SENDER_EMAIL").toLowerCase();
  const encodedKey = required("GMAIL_TOKEN_ENCRYPTION_KEY");

  if (senderEmail !== "admin@pacificinsuranceph.com") {
    throw new Error("Gmail setup must use the approved agency mailbox.");
  }

  let callback: URL;
  try {
    callback = new URL(redirectUri);
  } catch {
    throw new Error("Gmail setup requires a valid callback URL.");
  }
  const localDevelopment = process.env.NODE_ENV !== "production"
    && callback.hostname === "localhost";
  if (
    callback.pathname !== GMAIL_CALLBACK_PATH
    || callback.search !== "" || callback.hash !== ""
    || redirectUri.includes("?") || redirectUri.includes("#")
    || callback.username !== "" || callback.password !== ""
    || /^[a-z][a-z0-9+.-]*:\/\/[^/?#]*@/i.test(redirectUri)
    || !(callback.protocol === "https:" || (callback.protocol === "http:" && localDevelopment))
  ) {
    throw new Error("Gmail setup requires the fixed Gmail callback path and a secure origin (HTTP is allowed only on local development).");
  }

  const encryptionKey = Buffer.from(encodedKey, "base64");
  if (encryptionKey.length !== 32 || encryptionKey.toString("base64") !== encodedKey) {
    throw new Error("GMAIL_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key.");
  }
  return { clientId, clientSecret, redirectUri, senderEmail, encryptionKey };
}

export function gmailConfigurationProblem(): string | null {
  try {
    getGmailConfig();
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : "Gmail configuration is unavailable.";
  }
}
