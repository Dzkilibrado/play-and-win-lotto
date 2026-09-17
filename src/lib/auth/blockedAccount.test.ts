import { describe, expect, it } from "vitest";

import { BLOCKED_LOGIN_MESSAGE, isBlockedAuthError } from "./blockedAccount";

describe("blocked account errors", () => {
  it("recognizes provider and server blocked-account errors", () => {
    expect(isBlockedAuthError({ code: "user_banned", message: "User is banned" })).toBe(true);
    expect(isBlockedAuthError(new Error("ACCOUNT_BLOCKED"))).toBe(true);
  });

  it("does not classify invalid credentials as a block", () => {
    expect(isBlockedAuthError({ message: "Invalid login credentials" })).toBe(false);
    expect(BLOCKED_LOGIN_MESSAGE).not.toContain("UUID");
  });
});