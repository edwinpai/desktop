import { describe, expect, it, vi } from "vitest";
import {
  buildActionApprovalPayload,
  fetchPendingActionApprovals,
  resolveActionApproval,
} from "./action-approvals";

const { callGatewayMethodMock, invokeMock } = vi.hoisted(() => ({
  callGatewayMethodMock: vi.fn(async (_target, method) => {
    if (method === "action.approvals.resolve") {
      return { ok: true, category: "credential", decision: "granted" };
    }
    return {
      approvals: [
        {
          id: "a1",
          category: "exec",
          title: "echo ok",
          metadata: { command: "echo ok" },
        },
        { id: "s1", category: "subagent", title: "Implementation agent" },
        { nope: true },
      ],
    };
  }),
  invokeMock: vi.fn(async () => ({
    payload: "signed-payload",
    envelope: {
      kid: "kid",
      alg: "BSV-ECDSA",
      iat: 1,
      exp: 999,
      nonce: "nonce",
      payload_hash: "hash",
      sig: "sig",
      pub_key: "02abcdef",
    },
  })),
}));

vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));

vi.mock("@/lib/gateway-context", () => ({
  callGatewayMethod: callGatewayMethodMock,
  signGatewayParams: vi.fn(async (params) => ({
    ...params,
    signedEnvelope: { nonce: "gateway-nonce", payloadHash: "gateway-hash" },
  })),
}));

describe("action approvals API", () => {
  it("fetches and normalizes pending aggregate approvals", async () => {
    const result = await fetchPendingActionApprovals(
      { url: "ws://localhost", kind: "local" },
      { sessionKey: "agent:main:main" },
    );
    expect(result.approvals).toEqual([
      {
        id: "a1",
        category: "exec",
        title: "echo ok",
        metadata: { command: "echo ok" },
      },
      { id: "s1", category: "subagent", title: "Implementation agent" },
    ]);
  });

  it("builds canonical signed approval payloads", async () => {
    await expect(
      buildActionApprovalPayload({
        approvalId: "cred-1",
        category: "credential",
        decision: "granted",
        subject: { name: "Test", credentialId: "test" },
        payload: { credential: "secret" },
        approvedAt: "2026-05-07T21:00:00.000Z",
      }),
    ).resolves.toMatchObject({
      kind: "action-approval",
      version: 1,
      approvalId: "cred-1",
      category: "credential",
      decision: "granted",
      approvedAt: "2026-05-07T21:00:00.000Z",
      subjectHash: expect.any(String),
      payloadHash: expect.any(String),
    });
  });

  it("signs action approvals before aggregate resolve when subject is provided", async () => {
    await expect(
      resolveActionApproval(
        { url: "ws://localhost", kind: "local" },
        {
          id: "cred-1",
          category: "credential",
          decision: "granted",
          subject: {
            credentialId: "test-key",
            name: "Test key",
            purpose: "test",
          },
          payload: { credential: "secret" },
        },
      ),
    ).resolves.toEqual({
      ok: true,
      category: "credential",
      decision: "granted",
    });
    expect(invokeMock).toHaveBeenCalledWith(
      "sign_request",
      expect.objectContaining({
        payload: expect.stringContaining("action-approval"),
      }),
    );
    expect(callGatewayMethodMock).toHaveBeenCalledWith(
      { url: "ws://localhost", kind: "local" },
      "action.approvals.resolve",
      expect.objectContaining({
        id: "cred-1",
        category: "credential",
        decision: "granted",
        approvalPayload: expect.objectContaining({ kind: "action-approval" }),
        approvalEnvelope: expect.objectContaining({
          payloadHash: "hash",
          pubKey: "02abcdef",
        }),
        signedEnvelope: expect.objectContaining({
          nonce: "gateway-nonce",
          payloadHash: "gateway-hash",
        }),
      }),
      10000,
      "Timed out resolving action approval",
    );
  });
});
