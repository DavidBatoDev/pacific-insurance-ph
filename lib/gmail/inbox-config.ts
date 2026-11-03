import "server-only";

export interface GmailInboxConfig {
  topicName: string;
  subscriptionName: string;
  pushServiceAccount: string;
  pushAudience: string;
}

export function getGmailInboxConfig(): GmailInboxConfig {
  const topicName = process.env.GMAIL_PUBSUB_TOPIC?.trim() ?? "";
  const subscriptionName = process.env.GMAIL_PUBSUB_SUBSCRIPTION?.trim() ?? "";
  const pushServiceAccount = process.env.GMAIL_PUSH_SERVICE_ACCOUNT?.trim() ?? "";
  const pushAudience = process.env.GMAIL_PUSH_AUDIENCE?.trim() ?? "";
  const topic = /^projects\/([a-z][a-z0-9-]{4,61}[a-z0-9])\/topics\/[A-Za-z][A-Za-z0-9._~+%-]{2,254}$/.exec(topicName);
  if (!topic) throw new Error("Set GMAIL_PUBSUB_TOPIC to the Gmail topic resource name.");
  const project = topic[1];
  const subscriptionPrefix = `projects/${project}/subscriptions/`;
  if (!subscriptionName.startsWith(subscriptionPrefix) || !/^[A-Za-z][A-Za-z0-9._~+%-]{2,254}$/.test(subscriptionName.slice(subscriptionPrefix.length))) {
    throw new Error("Set GMAIL_PUBSUB_SUBSCRIPTION to a subscription in the Gmail topic project.");
  }
  const accountSuffix = `@${project}.iam.gserviceaccount.com`;
  if (!pushServiceAccount.endsWith(accountSuffix) || !/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(pushServiceAccount.slice(0, -accountSuffix.length))) {
    throw new Error("Set GMAIL_PUSH_SERVICE_ACCOUNT to the push-delivery service account email.");
  }
  let audience: URL;
  try { audience = new URL(pushAudience); } catch { throw new Error("Set GMAIL_PUSH_AUDIENCE to the public HTTPS notification endpoint."); }
  if (audience.protocol !== "https:" || audience.pathname !== "/api/integrations/gmail/notifications" || audience.search || audience.hash || audience.username || audience.password) {
    throw new Error("GMAIL_PUSH_AUDIENCE must be the exact public HTTPS notification endpoint without query parameters.");
  }
  return { topicName, subscriptionName, pushServiceAccount, pushAudience };
}

export function gmailInboxConfigurationProblem(): string | null {
  try { getGmailInboxConfig(); return null; } catch (error) {
    return error instanceof Error ? error.message : "Incoming Gmail delivery configuration is unavailable.";
  }
}
