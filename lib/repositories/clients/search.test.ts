import { describe, expect, it } from "vitest";

import { searchTokenFilter, searchTokens } from "./search";

describe("searchTokens", () => {
  it("splits on whitespace and drops empty tokens", () => {
    expect(searchTokens("  QA   OCT2\tApplicant ")).toEqual(["QA", "OCT2", "Applicant"]);
  });

  it("strips characters that break the PostgREST or-filter grammar", () => {
    expect(searchTokens("Doe, (John) 50%*")).toEqual(["Doe", "John", "50"]);
    expect(searchTokens(",() %*")).toEqual([]);
  });
});

describe("searchTokenFilter", () => {
  it("matches one token against every searchable column", () => {
    expect(searchTokenFilter("Doe")).toBe(
      "first_name.ilike.%Doe%,last_name.ilike.%Doe%,email.ilike.%Doe%,mobile_number.ilike.%Doe%,reference_no.ilike.%Doe%",
    );
  });
});
