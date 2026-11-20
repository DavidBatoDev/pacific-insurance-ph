import "server-only";

import { getClientsRepository } from "@/lib/repositories/clients";
import { getOutboundEmailRepository, type OutboundEmailRepository } from "@/lib/repositories/outbound-email";
import { getUsersRepository } from "@/lib/repositories/users";
import type { User } from "@/lib/repositories/users";
import { OutboundEmailError, requireEmailSender, toEmailSendView } from "./outbound-email";
import {
  SENT_EMAIL_MAX_PAGE, SENT_EMAIL_MAX_QUERY, SENT_EMAIL_PAGE_SIZE, SENT_EMAIL_STATUSES,
  type SentEmailDetail, type SentEmailFilters, type SentEmailPage, type SentEmailStatus,
} from "./sent-email.types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
/** The agency works in Philippine time (UTC+8, no DST). */
const MANILA_OFFSET = "+08:00";

type Params = Record<string, string | string[] | undefined>;

function single(params: Params, key: string): string | undefined {
  const value = params[key];
  if (Array.isArray(value)) throw new OutboundEmailError(`Use one "${key}" value at a time.`);
  return value;
}

function calendarDate(value: string | undefined, label: string): string | null {
  if (value === undefined || value === "") return null;
  const match = DATE.exec(value);
  const [year, month, day] = match ? [Number(match[1]), Number(match[2]), Number(match[3])] : [0, 0, 0];
  const date = new Date(Date.UTC(year, month - 1, day));
  if (!match || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new OutboundEmailError(`${label} must be a real date (YYYY-MM-DD).`);
  }
  return value;
}

/** Strict: malformed filters are rejected, never widened into a broader query. */
export function parseSentEmailFilters(params: Params): SentEmailFilters {
  const query = (single(params, "q") ?? "").trim();
  if (query.length > SENT_EMAIL_MAX_QUERY) throw new OutboundEmailError(`Search is limited to ${SENT_EMAIL_MAX_QUERY} characters.`);
  const rawStatus = single(params, "status") ?? "sent";
  if (!(SENT_EMAIL_STATUSES as readonly string[]).includes(rawStatus)) throw new OutboundEmailError("Choose a valid status.");
  const from = calendarDate(single(params, "from"), "From");
  const to = calendarDate(single(params, "to"), "To");
  if (from && to && from > to) throw new OutboundEmailError("From must be on or before To.");
  const rawPage = single(params, "page") ?? "1";
  const page = /^\d{1,5}$/.test(rawPage) ? Number(rawPage) : NaN;
  if (!Number.isInteger(page) || page < 1 || page > SENT_EMAIL_MAX_PAGE) throw new OutboundEmailError("That page does not exist.");
  return { query, status: rawStatus as SentEmailStatus, from, to, page };
}

/** A single selected-message UUID, or null when absent/invalid (treated as not found by callers). */
export function parseSelectedMessage(params: Params): string | null | "invalid" {
  const value = params.message;
  if (value === undefined || value === "") return null;
  return typeof value === "string" && UUID.test(value) ? value : "invalid";
}

/** Inclusive Manila day `from` → its midnight; inclusive `to` → the next day's midnight (exclusive). */
export function manilaRange(from: string | null, to: string | null): { from: string | null; to: string | null } {
  const start = (day: string) => new Date(`${day}T00:00:00${MANILA_OFFSET}`);
  return {
    from: from ? start(from).toISOString() : null,
    to: to ? new Date(start(to).getTime() + 86_400_000).toISOString() : null,
  };
}

export interface SentEmailDeps {
  sender: () => Promise<User>;
  repository: () => OutboundEmailRepository;
  clientLabel: (id: string) => Promise<{ name: string; referenceNo: string | null } | null>;
  userName: (id: string) => Promise<string | null>;
  now: () => number;
}

const defaultDeps: SentEmailDeps = {
  sender: requireEmailSender,
  repository: getOutboundEmailRepository,
  clientLabel: async (id) => {
    const client = await getClientsRepository().findById(id);
    return client ? { name: client.fullName, referenceNo: client.referenceNo } : null;
  },
  userName: async (id) => (await getUsersRepository().findById(id))?.fullName ?? null,
  now: Date.now,
};

export function createSentEmailService(overrides: Partial<SentEmailDeps> = {}) {
  const deps: SentEmailDeps = { ...defaultDeps, ...overrides };

  async function page(filters: SentEmailFilters): Promise<SentEmailPage> {
    const actor = await deps.sender();
    const range = manilaRange(filters.from, filters.to);
    const rows = await deps.repository().listAgency(actor.id, {
      query: filters.query, status: filters.status, ...range, offset: (filters.page - 1) * SENT_EMAIL_PAGE_SIZE,
    });
    return { messages: rows.slice(0, SENT_EMAIL_PAGE_SIZE), page: filters.page, hasNext: rows.length > SENT_EMAIL_PAGE_SIZE };
  }

  /** Read-only: never contacts Gmail. Filter membership is not required; SQL scoping is. */
  async function detail(id: string): Promise<SentEmailDetail> {
    const actor = await deps.sender();
    const row = UUID.test(id) ? await deps.repository().get(actor.id, id) : null;
    if (!row) throw new OutboundEmailError("Email not found.", 404);
    const [client, actorName] = await Promise.all([deps.clientLabel(row.clientId), deps.userName(row.actorId)]);
    return {
      email: toEmailSendView(row, deps.now()),
      clientId: row.clientId,
      clientName: client?.name || "Client",
      clientReference: client?.referenceNo ?? null,
      actorName: actorName || "Staff",
      targetKind: row.targetKind,
      targetId: row.targetId,
      createdAt: row.createdAt,
      dispatchStartedAt: row.dispatchStartedAt,
    };
  }

  return { page, detail };
}

export const sentEmailService = createSentEmailService();
