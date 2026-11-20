import { RenewalsLive } from "@/components/hub/screens/operations";
import { getRenewalAutomationRepository } from "@/lib/repositories/renewal-automation";
import { getRenewalsRepository } from "@/lib/repositories/renewals";
import { currentRenewalPerPolicy } from "@/lib/renewals/lifecycle";
import { getAgentScope } from "@/lib/auth/agent-scope";
import { getCurrentUser } from "@/lib/auth/current-user";
import { toAppRole } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";

/** Renewals queue — wired to the renewals table. */
export default async function Page() {
  const [rows, actor, rules] = await Promise.all([
    getAgentScope().then((ownerUserId) => getRenewalsRepository().list({ ownerUserId })),
    getCurrentUser(),
    getRenewalAutomationRepository().listRules(),
  ]);
  // The Settings "Carrier notice request" timing also marks when a missing notice is overdue.
  const noticeRequestOffsetDays = rules.find((rule) => rule.key === "missing_notice")?.offsetDays ?? null;
  return (
    <RenewalsLive
      rows={currentRenewalPerPolicy(rows)}
      noticeRequestOffsetDays={noticeRequestOffsetDays}
      canSyncPolicies={!!actor && toAppRole(actor.role) === "admin"}
    />
  );
}
