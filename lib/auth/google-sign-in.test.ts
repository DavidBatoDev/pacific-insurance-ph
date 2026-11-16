import type { UserIdentity } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { googleIdentityProblem, NOT_WORKSPACE_MESSAGE, safeRedirectPath } from "./google-sign-in";

const google = (data: Record<string, unknown>) => ({ provider: "google", identity_data: data }) as unknown as UserIdentity;
const workspace = { email: "eman@pacificinsuranceph.com", email_verified: true, custom_claims: { hd: "pacificinsuranceph.com" } };
const user = (identityData: Record<string, unknown>, email = "eman@pacificinsuranceph.com") => ({ email, identities: [google(identityData)] });

describe("googleIdentityProblem", () => {
  it("accepts a verified agency Workspace identity matching the CRM address", () => {
    expect(googleIdentityProblem(user(workspace))).toBeNull();
    expect(googleIdentityProblem(user({ ...workspace, custom_claims: undefined, hd: "PacificInsurancePH.com" }))).toBeNull();
  });

  it("rejects a consumer Google account registered under an agency address (no hosted domain)", () => {
    expect(googleIdentityProblem(user({ ...workspace, custom_claims: {} }))).toBe(NOT_WORKSPACE_MESSAGE);
  });

  it("rejects other Workspace domains, look-alikes and unverified or mismatched email", () => {
    for (const data of [
      { ...workspace, custom_claims: { hd: "evil.com" } },
      { ...workspace, custom_claims: { hd: "pacificinsuranceph.com.evil.com" } },
      { ...workspace, email_verified: false },
      { ...workspace, email_verified: "true" },
      { ...workspace, email: "someone@pacificinsuranceph.com" },
    ]) expect(googleIdentityProblem(user(data))).toBe(NOT_WORKSPACE_MESSAGE);
  });

  it("rejects a session without a Google identity", () => {
    expect(googleIdentityProblem({ email: "eman@pacificinsuranceph.com", identities: [] })).toBe(NOT_WORKSPACE_MESSAGE);
  });
});

describe("safeRedirectPath", () => {
  it("keeps same-origin paths and refuses everything that could leave the site", () => {
    expect(safeRedirectPath("/clients/abc?tab=1")).toBe("/clients/abc?tab=1");
    for (const value of ["//evil.com", "/\\evil.com", "https://evil.com", "dashboard", undefined, null]) {
      expect(safeRedirectPath(value)).toBe("/dashboard");
    }
  });
});
