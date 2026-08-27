"use client";

import type { TouchpointRow } from "@/lib/queries/relationship";
import { cn } from "@/lib/utils";
import type { Tone } from "../tone";
import { I, type IconName } from "../icons";
import { useRecordNav } from "../nav";
import { useOverlays } from "../overlays/overlay-provider";
import { Avatar, Btn, Card, CountPill, PageHead, TONE_SOFT } from "../primitives";

/**
 * Relationship Management — loyalty touchpoints derived from real client
 * records (design screens-extra.jsx RelationshipScreen, wired). Send
 * greetings opens the New Campaign drawer pre-set to the category.
 */
export function RelationshipLive({ touchpoints }: { touchpoints: TouchpointRow[] }) {
  const overlays = useOverlays();
  const { openContact } = useRecordNav();

  const cats: {
    key: TouchpointRow["type"];
    title: string;
    icon: IconName;
    tone: Tone;
    campaignType: string;
  }[] = [
    { key: "birthday", title: "Upcoming birthdays", icon: "cake", tone: "violet", campaignType: "Birthday" },
    { key: "anniversary", title: "Client anniversaries", icon: "award", tone: "green", campaignType: "Anniversary" },
    { key: "renurture", title: "Re-nurture queue", icon: "refresh", tone: "amber", campaignType: "Re-nurture" },
  ];

  return (
    <div>
      <PageHead
        icon={I.heart}
        title="Relationship Management"
        draft={false}
        sub="Nurture client loyalty with timely, personal touchpoints"
        actions={
          <Btn variant="primary" onClick={() => overlays.openCampaign("Birthday")}>
            <I.send size={15} /> New campaign
          </Btn>
        }
      />
      <div className="grid grid-cols-3 gap-4 max-[1000px]:grid-cols-1">
        {cats.map((cat) => {
          const items = touchpoints.filter((r) => r.type === cat.key);
          const Ico = I[cat.icon];
          return (
            <Card key={cat.key} className="flex flex-col self-start">
              <div className="flex items-center gap-2.5 border-b border-border-soft px-[18px] py-[15px]">
                <span className={cn("grid size-7 place-items-center rounded-lg", TONE_SOFT[cat.tone])}>
                  <Ico size={15} />
                </span>
                <h3 className="text-[14.5px] font-[650]">{cat.title}</h3>
                <CountPill>{items.length}</CountPill>
              </div>
              <div className="flex-1">
                {items.length === 0 && (
                  <div className="px-[18px] py-4 text-[12.5px] text-subtle">Nothing coming up.</div>
                )}
                {items.slice(0, 8).map((r) => (
                  <button
                    key={r.clientId + r.type}
                    onClick={() => openContact(r.clientId)}
                    className="flex w-full items-center gap-3 border-b border-border-soft px-[18px] py-[11px] text-left transition-colors last:border-b-0 hover:bg-hover"
                  >
                    <Avatar name={r.name} size={36} />
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-semibold">{r.name}</div>
                      <div className="mt-px text-[11.5px] text-muted-foreground">{r.sub}</div>
                    </div>
                    <span className={cn(
                      "whitespace-nowrap rounded-full px-2.5 py-[3px] text-[11px] font-bold",
                      r.daysUntil <= 7 ? "bg-amber-soft text-amber" : "bg-surface-3 text-muted-foreground",
                    )}>
                      {r.when}
                    </span>
                  </button>
                ))}
              </div>
              <div className="border-t border-border-soft p-3">
                <Btn size="sm" className="w-full justify-center" onClick={() => overlays.openCampaign(cat.campaignType)}>
                  Send greetings
                </Btn>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
