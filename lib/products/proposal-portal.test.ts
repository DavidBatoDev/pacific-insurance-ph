import { describe, expect, it } from "vitest";
import { portalPlanFor, splitFullName } from "./proposal-portal";

describe("portalPlanFor", () => {
  it("joins the Select variant and tier in the portal's wording", () => {
    expect(portalPlanFor("Select", "Select Standard", "Ward")).toEqual({ value: "STANDARD WARD", problem: null });
    expect(portalPlanFor("Select", "Select Standard", "Semi-Private")).toEqual({ value: "STANDARD S-PRIVATE", problem: null });
    expect(portalPlanFor("Select", "Select Plus", "Private 5M")).toEqual({ value: "PLUS PRIVATE 5M", problem: null });
  });

  it("reports what is missing instead of a partial plan", () => {
    expect(portalPlanFor("Select", null, "Ward").value).toBeNull();
    expect(portalPlanFor("Select", "Select Plus", null).value).toBeNull();
    expect(portalPlanFor("Select", "Select Standard", "Private 3M")).toEqual({ value: null, problem: "Private 3M is Select Plus only." });
  });

  it("passes a Blue Royale tier through unchanged", () => {
    expect(portalPlanFor("Blue Royale", null, "Plan B")).toEqual({ value: "Plan B", problem: null });
  });
});

describe("splitFullName", () => {
  it("keeps surname particles with the last name", () => {
    expect(splitFullName("Juan Carlos dela Cruz")).toEqual({ first: "Juan Carlos", last: "dela Cruz" });
    expect(splitFullName("Maria de la Cruz")).toEqual({ first: "Maria", last: "de la Cruz" });
    expect(splitFullName("Ana San Juan")).toEqual({ first: "Ana", last: "San Juan" });
  });

  it("splits a plain name on the last word and leaves a single word as the first name", () => {
    expect(splitFullName("  David   Bato-bato ")).toEqual({ first: "David", last: "Bato-bato" });
    expect(splitFullName("Andreas")).toEqual({ first: "Andreas", last: "" });
  });
});
