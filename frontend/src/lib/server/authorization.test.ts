import { describe, expect, it } from "vitest";
import { isAllowedRole } from "./authorization";

describe("role-based protection", () => {
  it("allows only explicitly listed staff roles", () => {
    expect(isAllowedRole("analyst", ["analyst", "admin"])).toBe(true);
    expect(isAllowedRole("policymaker", ["analyst", "admin"])).toBe(false);
    expect(isAllowedRole("citizen", ["analyst", "admin"])).toBe(false);
  });
});
