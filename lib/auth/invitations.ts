import "server-only";

import { randomUUID } from "node:crypto";

import { env } from "@/lib/env";
import { getGmailSendAccess } from "@/lib/gmail/access";
import { buildOutboundMime } from "@/lib/gmail/outbound-mime";
import { sendGmailMessage } from "@/lib/gmail/send-api";
import { getUsersRepository, type User } from "@/lib/repositories/users";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

import { STAFF_ROLE_LABELS, type InvitableRole } from "./staff-email";

/**
 * Staff invitations (Phase I). The Owner creates the auth user with Supabase's admin API and the
 * CRM delivers the link itself: Supabase's built-in mailer is development-only, so invites go out
 * through the agency's Gmail sender and the inviter always receives a copyable link as well (the
 * Gmail send is best-effort). The invitee never receives a password; the link lands on
 * `/auth/confirm`, which verifies the token server-side and sends them to `/set-password`.
 */

export const INVITE_LINK_PATH = "/auth/confirm";

export class InvitationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvitationError";
  }
}

export interface InvitationDelivery {
  /** The link the invitee must open; shown to the inviter regardless of email outcome. */
  inviteUrl: string;
  /** True only when Gmail accepted the message. */
  emailed: boolean;
  /** Human-readable reason when `emailed` is false. */
  emailProblem: string | null;
}

export interface InvitationResult extends InvitationDelivery {
  user: User;
}

function inviteUrl(hashedToken: string): string {
  const url = new URL(INVITE_LINK_PATH, env.APP_URL);
  url.searchParams.set("token_hash", hashedToken);
  url.searchParams.set("type", "invite");
  return url.toString();
}

/**
 * Issues an invite token for `email`. A brand-new address creates the auth user; an existing
 * unconfirmed one is re-issued. Supabase refuses `invite` once the address is confirmed, which can
 * only happen if the account was activated — callers guard on `users.status` first.
 */
async function generateInviteLink(email: string, fullName: string): Promise<{ userId: string; url: string }> {
  const { data, error } = await getSupabaseAdmin().auth.admin.generateLink({
    type: "invite",
    email,
    options: { data: { full_name: fullName }, redirectTo: `${env.APP_URL}${INVITE_LINK_PATH}` },
  });
  if (error || !data.user || !data.properties?.hashed_token) {
    throw new InvitationError(error?.message ?? "Supabase did not return an invitation link.");
  }
  return { userId: data.user.id, url: inviteUrl(data.properties.hashed_token) };
}

function invitationEmailBody(input: { fullName: string; inviterName: string; role: string; url: string }): string {
  return [
    `Hi ${input.fullName},`,
    "",
    `${input.inviterName} invited you to the Pacific Insurance PH Operations Hub as ${STAFF_ROLE_LABELS[input.role] ?? input.role}.`,
    "",
    "Open the link below to choose your password and activate your account:",
    input.url,
    "",
    "The link works once and expires after 24 hours. If it has expired, ask the inviter to resend it.",
    "If you were not expecting this invitation, reply to this email to let Matt know.",
    "",
    "Pacific Insurance PH",
  ].join("\n");
}

/** Best-effort Gmail delivery from the agency mailbox; never throws. */
async function emailInvitation(input: { to: string; fullName: string; inviterName: string; role: string; url: string }): Promise<Pick<InvitationDelivery, "emailed" | "emailProblem">> {
  try {
    const access = await getGmailSendAccess();
    const raw = await buildOutboundMime({
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      recipient: input.to,
      subject: "You're invited to the Pacific Insurance PH Operations Hub",
      body: invitationEmailBody(input),
      references: [],
      attachments: [],
    });
    await sendGmailMessage({ raw }, access);
    return { emailed: true, emailProblem: null };
  } catch (error) {
    const reason = error instanceof Error && error.message ? error.message : "Gmail is not available.";
    return { emailed: false, emailProblem: `The invitation email was not sent (${reason}). Share the link below directly.` };
  }
}

export interface CreateInvitationInput {
  email: string;
  fullName: string;
  role: InvitableRole;
  invitedBy: { id: string; fullName: string };
}

/** Creates the auth user + `Invited` users row, then attempts delivery. */
export async function createInvitation(input: CreateInvitationInput): Promise<InvitationResult> {
  const users = getUsersRepository();
  if (await users.findByEmail(input.email)) throw new InvitationError("A team member with this email already exists.");

  const link = await generateInviteLink(input.email, input.fullName);
  const user = await users.create({
    id: link.userId,
    fullName: input.fullName,
    email: input.email,
    role: input.role,
    status: "Invited",
    invitedBy: input.invitedBy.id,
    invitedAt: new Date().toISOString(),
  });
  const delivery = await emailInvitation({ to: user.email, fullName: user.fullName, inviterName: input.invitedBy.fullName, role: input.role, url: link.url });
  return { user, inviteUrl: link.url, ...delivery };
}

/** Re-issues the link for a still-`Invited` user and attempts delivery again. */
export async function resendInvitation(user: User, inviter: { id: string; fullName: string }): Promise<InvitationResult> {
  if (user.status !== "Invited") throw new InvitationError("Only pending invitations can be resent.");
  const link = await generateInviteLink(user.email, user.fullName);
  if (link.userId !== user.id) throw new InvitationError("The invitation no longer matches this team member.");
  const updated = await getUsersRepository().update(user.id, { invitedAt: new Date().toISOString() });
  const delivery = await emailInvitation({ to: user.email, fullName: user.fullName, inviterName: inviter.fullName, role: user.role, url: link.url });
  return { user: updated, inviteUrl: link.url, ...delivery };
}

/**
 * Removes a pending invitation. The only hard delete the app performs on `users`: nothing can
 * reference an account that was never activated. `public.users` cascades from `auth.users`.
 */
export async function revokeInvitation(user: User): Promise<void> {
  if (user.status !== "Invited") throw new InvitationError("Only pending invitations can be revoked.");
  const { error } = await getSupabaseAdmin().auth.admin.deleteUser(user.id);
  if (error) throw new InvitationError(error.message);
}
