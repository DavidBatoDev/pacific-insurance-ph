import { describe, expect, it } from "vitest";
import { isGmailPushIdentity, parseGmailNotification } from "./notifications";

const subscription = "projects/pacific-insurane-ph/subscriptions/pacific-gmail-inbox-push";
const mailbox = "admin@pacificinsuranceph.com";
const serviceAccount = "pacific-gmail-push@pacific-insurane-ph.iam.gserviceaccount.com";
const envelope = (payload: unknown) => ({ subscription, message: { messageId: "1234567890", data: Buffer.from(JSON.stringify(payload)).toString("base64") } });

describe("authenticated Gmail delivery", () => {
  it("requires the exact verified push service account, not just any Google identity", () => {
    expect(isGmailPushIdentity({ email: serviceAccount, email_verified: true }, serviceAccount)).toBe(true);
    expect(isGmailPushIdentity({ email: mailbox, email_verified: true }, serviceAccount)).toBe(false);
    expect(isGmailPushIdentity({ email: serviceAccount, email_verified: false }, serviceAccount)).toBe(false);
    expect(isGmailPushIdentity(undefined, serviceAccount)).toBe(false);
  });

  it("preserves Gmail's decimal cursor without lossy number conversion", () => {
    const historyId = "900719925474099312345";
    expect(parseGmailNotification(envelope({ emailAddress: mailbox, historyId }), subscription, mailbox)).toEqual({ messageId: "1234567890", historyId, emailAddress: mailbox, subscription });
  });

  it.each([12345, Number.MAX_SAFE_INTEGER])("accepts numeric history ID %s without changing its value", (historyId) => {
    expect(parseGmailNotification(envelope({ emailAddress: mailbox, historyId }), subscription, mailbox)).toEqual({
      messageId: "1234567890", historyId: String(historyId), emailAddress: mailbox, subscription,
    });
  });

  it.each([0, -1, 12.5, Number.MAX_SAFE_INTEGER + 1])("rejects invalid or inexact numeric history ID %s", (historyId) => {
    expect(() => parseGmailNotification(envelope({ emailAddress: mailbox, historyId }), subscription, mailbox)).toThrow();
  });

  it("rejects a different subscription or mailbox even when the envelope is well formed", () => {
    const value = envelope({ emailAddress: mailbox, historyId: "12345" });
    expect(() => parseGmailNotification({ ...value, subscription: subscription + "-other" }, subscription, mailbox)).toThrow();
    expect(() => parseGmailNotification(envelope({ emailAddress: "other@pacificinsuranceph.com", historyId: "12345" }), subscription, mailbox)).toThrow();
  });

  it.each(["0", "-1", "1e6", "12.5", null])("rejects invalid cursors without inventing a checkpoint: %s", (historyId) => {
    expect(() => parseGmailNotification(envelope({ emailAddress: mailbox, historyId }), subscription, mailbox)).toThrow();
  });

  it("rejects noncanonical base64 rather than silently accepting decoder garbage", () => {
    const value = envelope({ emailAddress: mailbox, historyId: "12345" });
    expect(() => parseGmailNotification({ ...value, message: { ...value.message, data: value.message.data + "!" } }, subscription, mailbox)).toThrow();
  });
});
