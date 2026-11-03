import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { GmailAuthorizationError } from "./policy";

function encryptionError(): GmailAuthorizationError {
  return new GmailAuthorizationError("token_encryption_error", false);
}

function requireInputs(key: Buffer, context: string): void {
  if (!Buffer.isBuffer(key) || key.length !== 32 || !context) throw encryptionError();
}

function decodePart(value: string, length?: number): Buffer {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw encryptionError();
  const bytes = Buffer.from(value, "base64url");
  if (bytes.toString("base64url") !== value || (length !== undefined && bytes.length !== length)) {
    throw encryptionError();
  }
  return bytes;
}

export function encryptToken(plaintext: string, key: Buffer, context: string): string {
  requireInputs(key, context);
  if (!plaintext) throw encryptionError();
  try {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv, { authTagLength: 16 });
    cipher.setAAD(Buffer.from(context, "utf8"));
    const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ciphertext.toString("base64url")].join(".");
  } catch {
    throw encryptionError();
  }
}

export function decryptToken(envelope: string, key: Buffer, context: string): string {
  requireInputs(key, context);
  try {
    const parts = envelope.split(".");
    if (parts.length !== 4 || parts[0] !== "v1") throw encryptionError();
    const iv = decodePart(parts[1], 12);
    const tag = decodePart(parts[2], 16);
    const ciphertext = decodePart(parts[3]);
    const decipher = createDecipheriv("aes-256-gcm", key, iv, { authTagLength: 16 });
    decipher.setAAD(Buffer.from(context, "utf8"));
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
    if (!plaintext) throw encryptionError();
    return plaintext;
  } catch {
    throw encryptionError();
  }
}
