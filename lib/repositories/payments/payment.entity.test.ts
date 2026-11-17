import { describe, expect, it } from "vitest";

import { installmentLabel } from "./payment.entity";

describe("installmentLabel", () => {
  it("labels only schedules with several installments", () => {
    expect(installmentLabel({ installmentNumber: 2, installmentCount: 2 })).toBe("installment 2/2");
    // An Annual renewal is stored as 1 of 1 by trigger 0050; showing "1/1" tells staff nothing.
    expect(installmentLabel({ installmentNumber: 1, installmentCount: 1 })).toBeNull();
    expect(installmentLabel({ installmentNumber: null, installmentCount: null })).toBeNull();
  });
});
