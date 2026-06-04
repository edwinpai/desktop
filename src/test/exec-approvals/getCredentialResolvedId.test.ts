import { describe, expect, it } from "vitest";

import { getCredentialResolvedId } from "../../components/exec-approvals/ExecApprovalsPanel";

describe("getCredentialResolvedId", () => {
  it("prefers payload.id when present", () => {
    expect(getCredentialResolvedId({ id: "cred-123" })).toBe("cred-123");
  });

  it("falls back to payload.requestId (gateway shape)", () => {
    expect(getCredentialResolvedId({ requestId: "cred-456" })).toBe("cred-456");
  });

  it("returns null for invalid payloads", () => {
    expect(getCredentialResolvedId(null)).toBeNull();
    expect(getCredentialResolvedId(undefined)).toBeNull();
    expect(getCredentialResolvedId("cred-789")).toBeNull();
    expect(getCredentialResolvedId({})).toBeNull();
    expect(getCredentialResolvedId({ id: 123 })).toBeNull();
    expect(getCredentialResolvedId({ requestId: 123 })).toBeNull();
  });
});

