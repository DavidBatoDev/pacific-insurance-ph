import { describe, expect, it } from "vitest";
import { fillTemplate } from "./merge";

describe("renewal template merge", () => {
  it("keeps client, carrier, policy and receipt dates distinct in the reviewed email", () => {
    expect(fillTemplate("Hi {{recipient_name}}: {client_name}, {{policy_number}}, renewal {{renewal_date}}, receipt {{notice_received_date}}. {{first_name}} / {{product}} / {{agent}}", {
      recipient_name: "Thea", client_name: "Ana Cruz", first_name: "Ana", policy_number: "PC-98765",
      renewal_date: "2026-12-01", notice_received_date: "2026-10-10", product: "Select", agent: "Eman",
    })).toBe("Hi Thea: Ana Cruz, PC-98765, renewal 2026-12-01, receipt 2026-10-10. Ana / Select / Eman");
  });

  it("does not recursively interpret client values or erase unsupported placeholders", () => {
    expect(fillTemplate("{{client_name}} / {{premium}} / {{custom_carrier_field}}", {
      client_name: "A {{premium}} B", premium: "to be reviewed",
    })).toBe("A {{premium}} B / to be reviewed / {{custom_carrier_field}}");
  });
});
