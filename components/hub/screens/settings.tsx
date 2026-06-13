"use client";

/**
 * DRAFT — mock UI only.
 * Ported from drafts/src/screens-extra.jsx for prototype review. Form inputs are
 * uncontrolled placeholders — nothing saves, and no real data layer is wired up yet.
 */
import { useState } from "react";

import { cn } from "@/lib/utils";
import { I } from "../icons";
import { Btn, Card, PageHead } from "../primitives";

const TABS = ["General", "Team", "Notifications", "Billing", "Integrations"] as const;
const GENERAL_FIELDS = [
  { label: "Agency name", val: "Pacific Insurance PH" },
  { label: "Primary carrier", val: "Pacific Cross" },
  { label: "Business address", val: "Ayala Avenue, Makati City, Metro Manila" },
  { label: "Contact email", val: "ops@pacificinsurance.ph" },
];

export function SettingsScreen() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("General");
  return (
    <div>
      <PageHead icon={I.settings} title="Settings" sub="Manage your agency workspace and preferences" />
      <Card className="overflow-hidden">
        <div className="flex gap-1 border-b border-border-soft px-3 py-2">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "h-8 rounded-md px-3 text-[12.5px] font-semibold transition-colors",
                tab === t ? "bg-brand-soft text-brand-hover" : "text-muted-foreground hover:bg-hover",
              )}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="max-w-[640px] p-6">
          {tab === "General" ? (
            <div className="flex flex-col gap-5">
              {GENERAL_FIELDS.map((f) => (
                <div key={f.label}>
                  <label className="mb-1.5 block text-[12.5px] font-[650] text-muted-foreground">{f.label}</label>
                  <input
                    defaultValue={f.val}
                    className="h-[38px] w-full rounded-md border border-border-strong bg-surface px-[13px] text-[13.5px] text-foreground outline-none focus:border-brand focus:ring-[3px] focus:ring-brand/20"
                  />
                </div>
              ))}
              <div className="flex gap-2.5 pt-1">
                <Btn variant="primary">Save changes</Btn>
                <Btn>Cancel</Btn>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center py-10 text-center text-muted-foreground">
              <div className="mb-4 grid size-[58px] place-items-center rounded-2xl bg-brand-soft text-brand-hover">
                <I.settings size={26} />
              </div>
              <h2 className="mb-1.5 text-[18px] text-foreground">{tab} settings</h2>
              <p className="max-w-[360px] leading-relaxed">
                This section is part of the full workspace configuration. Connect your account to manage{" "}
                {tab.toLowerCase()} options.
              </p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
