import { describe, expect, it } from "vitest";
import { catalogSelectionProblem, type CatalogSelectionInput, type SelectionPlan, type SelectionVersion } from "./selection-rules";

const version: SelectionVersion = { id: "select-v1", status: "Active", product: { name: "Select", category: "Primary Medical", status: "Active" } };
const plan: SelectionPlan = { id: "plus-5m", product_version_id: "select-v1", plan_family: "Select Plus", status: "Active" };
const input: CatalogSelectionInput = { productVersionId: "select-v1", planOptionId: "plus-5m", selectVariant: "Select Plus", completing: true };

describe("authoritative catalog selection before writes", () => {
  it("accepts a matching active Select selection", () => {
    expect(catalogSelectionProblem(input, version, plan)).toBeNull();
  });
  it("permits incomplete drafts but not supplied mismatches", () => {
    expect(catalogSelectionProblem({ completing: false }, null, null)).toBeNull();
    expect(catalogSelectionProblem({ productVersionId: version.id, completing: false }, version, null)).toBeNull();
    expect(catalogSelectionProblem({ ...input, completing: false, selectVariant: "Select Standard" }, version, plan)).toMatch(/matching.*variant/);
    expect(catalogSelectionProblem({ ...input, completing: false, selectVariant: "" }, version, plan)).toMatch(/matching.*variant/);
  });
  it("rejects missing, invalid and mismatched variants for completing Select saves", () => {
    for (const selectVariant of [null, "", "select plus", "Ward", "Select Plus ", "Select Standard"]) {
      expect(catalogSelectionProblem({ ...input, selectVariant }, version, plan)).not.toBeNull();
    }
    expect(catalogSelectionProblem({ ...input, planOptionId: null }, version, null)).toMatch(/matching active plan/);
  });
  it("rejects foreign, inactive, missing and wrong-version plans even on drafts", () => {
    for (const invalidPlan of [null, { ...plan, id: "foreign" }, { ...plan, status: "Inactive" }, { ...plan, product_version_id: "other-version" }]) {
      expect(catalogSelectionProblem({ ...input, completing: false }, version, invalidPlan)).toMatch(/active product version/);
    }
    expect(catalogSelectionProblem({ ...input, productVersionId: null }, null, plan)).toMatch(/before its variant or plan/);
  });
  it("rejects missing/inactive product authority rather than trusting browser labels", () => {
    for (const invalidVersion of [null, { ...version, id: "other-version" }, { ...version, status: "Inactive" }, { ...version, product: { ...version.product!, status: "Inactive" } }]) {
      expect(catalogSelectionProblem(input, invalidVersion, plan)).toMatch(/active product version/);
    }
  });
  it("does not apply Select semantics to other products or accept stale Select preferences", () => {
    const otherVersion = { ...version, product: { name: "Blue Royale", category: "Primary Medical", status: "Active" } };
    expect(catalogSelectionProblem(input, otherVersion, plan)).toMatch(/another product/);
    expect(catalogSelectionProblem({ ...input, selectVariant: null }, otherVersion, plan)).toBeNull();
    expect(catalogSelectionProblem({ productVersionId: version.id, completing: true, requireHealthPlan: true }, otherVersion, null)).toMatch(/matching active plan/);
    const travelVersion = { ...version, product: { name: "TravelSafe", category: "Travel Insurance", status: "Active" } };
    expect(catalogSelectionProblem({ productVersionId: version.id, completing: true }, travelVersion, null)).toBeNull();
  });
});
