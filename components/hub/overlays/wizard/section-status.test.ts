import { describe, expect, it } from "vitest";

import { emptyWizardForm, sectionStatus } from "./wizard-data";

describe("sectionStatus", () => {
  it("counts what a group still needs, then reads Complete", () => {
    const f = emptyWizardForm();
    expect(sectionStatus(f, "workflow")).toEqual({ status: "todo", label: "2 needed" });
    expect(sectionStatus({ ...f, appType: "New Insurance Application", source: "Referral" }, "workflow")).toEqual({ status: "done", label: "Complete" });
  });

  it("flags reversed trip dates as attention, not done", () => {
    const f = { ...emptyWizardForm(), destination: "Japan", departure: "2026-12-08", returnDate: "2026-12-01" };
    expect(sectionStatus(f, "trip")).toEqual({ status: "attention", label: "Return is before departure" });
    expect(sectionStatus({ ...f, returnDate: "2026-12-15" }, "trip").status).toBe("done");
  });

  it("treats a linked client as complete for name and contact", () => {
    const f = { ...emptyWizardForm(), clientMode: "existing" as const, existingClientId: "c1" };
    expect(sectionStatus(f, "client").status).toBe("done");
    expect(sectionStatus(f, "contact").status).toBe("done");
    expect(sectionStatus({ ...f, existingClientId: null }, "client")).toEqual({ status: "todo", label: "Pick a client" });
  });
});
