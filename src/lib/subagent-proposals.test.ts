import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  approveSubagentProposal,
  consolidateSubagentProposal,
  executeSubagentProposal,
  fetchExecutableSubagentProposals,
  fetchPendingSubagentProposalApprovals,
  rejectSubagentProposal,
} from "./subagent-proposals";

const callGatewayMethodMock = vi.fn();
vi.mock("@/lib/gateway-context", () => ({
  callGatewayMethod: (...args: unknown[]) => callGatewayMethodMock(...args),
  signGatewayParams: async (params: Record<string, unknown>) => ({
    ...params,
    signedEnvelope: { payloadHash: "hash", pubKey: "02abcdef" },
  }),
}));

const target = {
  kind: "local" as const,
  url: "http://127.0.0.1:18789",
  token: "token",
};

describe("subagent proposal desktop API bindings", () => {
  beforeEach(() => {
    callGatewayMethodMock.mockReset();
  });

  it("fetches and normalizes pending proposal approvals", async () => {
    callGatewayMethodMock.mockResolvedValue({
      proposals: [
        {
          sessionKey: "agent:main:main",
          taskId: "task-1",
          proposal: {
            id: "proposal-implementation",
            agentTypeId: "implementation-agent",
            status: "proposed",
            createdAt: "2026-05-07T18:00:00.000Z",
            updatedAt: "2026-05-07T18:00:00.000Z",
          },
        },
        { proposal: { id: "missing-agent-type" } },
      ],
    });

    const result = await fetchPendingSubagentProposalApprovals(
      target,
      "agent:main:main",
      5000,
    );

    expect(callGatewayMethodMock).toHaveBeenCalledWith(
      target,
      "subagents.proposals.pending",
      { sessionKey: "agent:main:main" },
      5000,
      "Timed out fetching pending subagent proposals",
    );
    expect(result.proposals).toHaveLength(1);
    expect(result.proposals[0]).toMatchObject({
      sessionKey: "agent:main:main",
      taskId: "task-1",
      proposal: {
        id: "proposal-implementation",
        agentTypeId: "implementation-agent",
      },
    });
  });

  it("approves proposal metadata through gateway RPC", async () => {
    callGatewayMethodMock.mockResolvedValue({
      proposal: {
        id: "proposal-implementation",
        agentTypeId: "implementation-agent",
        status: "approved",
      },
    });

    await approveSubagentProposal(target, {
      sessionKey: "agent:main:main",
      taskId: "task-1",
      proposalId: "proposal-implementation",
      approvalRequestId: "approval-123",
      approvedBy: "desktop:jake",
    });

    expect(callGatewayMethodMock).toHaveBeenCalledWith(
      target,
      "subagents.proposals.approve",
      {
        sessionKey: "agent:main:main",
        taskId: "task-1",
        proposalId: "proposal-implementation",
        approvalRequestId: "approval-123",
        approvedBy: "desktop:jake",
      },
      10000,
      "Timed out approving subagent proposal",
    );
  });

  it("forwards delegationPayload and delegationEnvelope when provided", async () => {
    callGatewayMethodMock.mockResolvedValue({
      proposal: {
        id: "proposal-implementation",
        agentTypeId: "implementation-agent",
        status: "approved",
      },
    });

    const delegationPayload = {
      kind: "subagent-delegation",
      version: 1,
      sessionKey: "agent:main:main",
      taskId: "task-1",
      proposalId: "proposal-implementation",
      agentTypeId: "implementation-agent",
      approvedAt: "2026-05-07T19:51:00.000Z",
      approvalRequestId: "approval-123",
    };
    const delegationEnvelope = {
      kid: "key-1",
      alg: "BSV",
      iat: 1746650000,
      exp: 1746653600,
      nonce: "abc",
      payload_hash: "deadbeef",
      sig: "sigvalue",
      pub_key: "pubkeyvalue",
    };

    await approveSubagentProposal(target, {
      sessionKey: "agent:main:main",
      taskId: "task-1",
      proposalId: "proposal-implementation",
      approvalRequestId: "approval-123",
      approvedBy: "desktop:jake",
      delegationPayload,
      delegationEnvelope,
    });

    expect(callGatewayMethodMock).toHaveBeenCalledWith(
      target,
      "subagents.proposals.approve",
      {
        sessionKey: "agent:main:main",
        taskId: "task-1",
        proposalId: "proposal-implementation",
        approvalRequestId: "approval-123",
        approvedBy: "desktop:jake",
        delegationPayload,
        delegationEnvelope,
      },
      10000,
      "Timed out approving subagent proposal",
    );
  });

  it("rejects proposal metadata through gateway RPC", async () => {
    callGatewayMethodMock.mockResolvedValue({
      proposal: {
        id: "proposal-implementation",
        agentTypeId: "implementation-agent",
        status: "rejected",
      },
    });

    await rejectSubagentProposal(target, {
      sessionKey: "agent:main:main",
      proposalId: "proposal-implementation",
    });

    expect(callGatewayMethodMock).toHaveBeenCalledWith(
      target,
      "subagents.proposals.reject",
      {
        sessionKey: "agent:main:main",
        proposalId: "proposal-implementation",
      },
      10000,
      "Timed out rejecting subagent proposal",
    );
  });

  it("fetches executable proposal status", async () => {
    callGatewayMethodMock.mockResolvedValue({
      proposals: [
        {
          sessionKey: "agent:main:main",
          taskId: "task-1",
          proposal: {
            id: "proposal-implementation",
            agentTypeId: "implementation-agent",
            status: "executed",
            result: {
              childSessionKey: "agent:implementation-agent:subagent:child",
              runId: "run-1",
            },
            createdAt: "2026-05-07T18:00:00.000Z",
            updatedAt: "2026-05-07T18:00:00.000Z",
          },
        },
      ],
    });

    const result = await fetchExecutableSubagentProposals(
      target,
      "agent:main:main",
    );

    expect(callGatewayMethodMock).toHaveBeenCalledWith(
      target,
      "subagents.proposals.executable",
      { sessionKey: "agent:main:main" },
      10000,
      "Timed out fetching executable subagent proposals",
    );
    expect(result.proposals[0]?.proposal.result?.runId).toBe("run-1");
  });

  it("executes proposal through signed gateway RPC", async () => {
    callGatewayMethodMock.mockResolvedValue({
      proposal: {
        id: "proposal-implementation",
        agentTypeId: "implementation-agent",
        status: "executed",
      },
    });

    await executeSubagentProposal(target, {
      sessionKey: "agent:main:main",
      taskId: "task-1",
      proposalId: "proposal-implementation",
    });

    expect(callGatewayMethodMock).toHaveBeenCalledWith(
      target,
      "subagents.proposals.execute",
      expect.objectContaining({
        sessionKey: "agent:main:main",
        taskId: "task-1",
        proposalId: "proposal-implementation",
        signedEnvelope: expect.any(Object),
      }),
      10000,
      "Timed out executing subagent proposal",
    );
  });

  it("consolidates executed proposal child status through gateway RPC", async () => {
    callGatewayMethodMock.mockResolvedValue({
      proposal: {
        id: "proposal-implementation",
        agentTypeId: "implementation-agent",
        status: "executed",
        result: {
          status: "completed",
          childSessionKey: "agent:impl:subagent:child",
          runId: "run-1",
          summary: "Feature implemented",
        },
      },
      consolidation: {
        status: "completed",
        summary: "Feature implemented",
        childSessionFound: true,
        consolidatedAt: "2026-05-08T03:00:00.000Z",
      },
    });

    const result = await consolidateSubagentProposal(target, {
      sessionKey: "agent:main:main",
      taskId: "task-1",
      proposalId: "proposal-implementation",
    });

    expect(callGatewayMethodMock).toHaveBeenCalledWith(
      target,
      "subagents.proposals.consolidate",
      {
        sessionKey: "agent:main:main",
        taskId: "task-1",
        proposalId: "proposal-implementation",
      },
      10000,
      "Timed out consolidating subagent proposal",
    );
    expect(result.consolidation.status).toBe("completed");
    expect(result.proposal.result?.summary).toBe("Feature implemented");
  });
});
