import { describe, expect, it } from "vitest";
import {
  describeGenericActionApproval,
  execActionApprovalSubject,
  normalizeCredentialFromActionApproval,
  normalizeExecRequestFromActionApproval,
  normalizeGenericActionApproval,
  normalizeGenericActionApprovalEvent,
  normalizeToolInvokeEvent,
} from "./ExecApprovalsPanel";

describe("ExecApprovalsPanel approval normalizers", () => {
  it("normalizes aggregate exec approvals into live request cards", () => {
    expect(
      normalizeExecRequestFromActionApproval({
        id: "exec-1",
        category: "exec",
        title: "Run command",
        description: "echo ok",
        agentId: "main",
        sessionKey: "agent:main:main",
        createdAt: "2026-05-11T15:00:00.000Z",
        metadata: {
          command: "echo ok",
          cwd: "/tmp",
          host: "gateway",
          security: "allowlist",
          ask: "always",
          resolvedPath: "/usr/bin/echo",
          createdAtMs: 100,
          expiresAtMs: 200,
        },
      }),
    ).toEqual({
      id: "exec-1",
      request: {
        category: "exec",
        title: "Run command",
        command: "echo ok",
        cwd: "/tmp",
        host: "gateway",
        security: "allowlist",
        ask: "always",
        agentId: "main",
        resolvedPath: "/usr/bin/echo",
        sessionKey: "agent:main:main",
      },
      createdAtMs: 100,
      expiresAtMs: 200,
    });
  });

  it("preserves non-expiring aggregate approvals", () => {
    const normalized = normalizeExecRequestFromActionApproval({
      id: "exec-no-expiry",
      category: "exec",
      title: "Run command",
      description: "echo ok",
      metadata: {
        command: "echo ok",
        createdAtMs: 100,
        expiresAtMs: null,
      },
    });

    expect(normalized?.expiresAtMs).toBeNull();
  });

  it("builds the canonical exec subject signed by action approvals", () => {
    const normalized = normalizeExecRequestFromActionApproval({
      id: "exec-1",
      category: "exec",
      title: "Run command",
      description: "echo ok",
      createdAt: "2026-05-11T15:00:00.000Z",
      metadata: {
        command: "echo ok",
        cwd: "/tmp",
        host: "gateway",
        security: "allowlist",
        ask: "always",
        resolvedPath: null,
      },
    });
    expect(normalized).not.toBeNull();
    expect(execActionApprovalSubject(normalized!)).toEqual({
      category: "exec",
      title: "Run command",
      command: "echo ok",
      cwd: "/tmp",
      host: "gateway",
      security: "allowlist",
      ask: "always",
      agentId: null,
      resolvedPath: null,
      sessionKey: null,
    });
  });

  it("normalizes aggregate credential approvals with canonical request subject", () => {
    const normalized = normalizeCredentialFromActionApproval({
      id: "cred-1",
      category: "credential",
      title: "API key",
      description: "Run model",
      metadata: {
        createdAtMs: 100,
        expiresAtMs: 200,
        request: {
          credentialId: "openai-api-key",
          name: "OpenAI API key",
          purpose: "Run model",
          requester: "agent",
          leaseDurationMs: 60000,
        },
      },
    });
    expect(normalized).toMatchObject({
      id: "cred-1",
      credentialId: "openai-api-key",
      name: "OpenAI API key",
      purpose: "Run model",
      requester: "agent",
      leaseDurationMs: 60000,
      createdAtMs: 100,
      expiresAtMs: 200,
    });
    expect(normalized?.actionApprovalSubject).toEqual({
      credentialId: "openai-api-key",
      name: "OpenAI API key",
      purpose: "Run model",
      requester: "agent",
      leaseDurationMs: 60000,
    });
  });

  it("normalizes generic action approval categories for unified rendering", () => {
    expect(
      normalizeGenericActionApproval({
        id: "config-1",
        category: "config",
        title: "Patch config",
        description: "Change TTS",
        metadata: { actionType: "config.patch", risk: "high" },
      }),
    ).toEqual({
      id: "config-1",
      category: "config",
      title: "Patch config",
      description: "Change TTS",
      createdAt: undefined,
      metadata: { actionType: "config.patch", risk: "high" },
    });
    expect(
      normalizeGenericActionApproval({
        id: "exec-1",
        category: "exec",
        title: "echo ok",
      }),
    ).toBeNull();
  });

  it("normalizes generic action approval stream events", () => {
    expect(
      normalizeGenericActionApprovalEvent({
        id: "browser-1",
        request: {
          category: "browser",
          title: "Browser request /tabs",
          command: "browser.request",
          cwd: null,
          host: "gateway",
          security: "full",
          ask: "always",
          resolvedPath: null,
          subject: {
            method: "browser.request",
            params: { method: "GET", path: "/tabs" },
          },
        },
        createdAtMs: 100,
        expiresAtMs: null,
      } as never),
    ).toMatchObject({
      id: "browser-1",
      category: "browser",
      title: "Browser request /tabs",
      description: "browser.request",
      subject: {
        method: "browser.request",
        params: { method: "GET", path: "/tabs" },
      },
      metadata: {
        command: "browser.request",
        expiresAtMs: null,
      },
    });
  });

  it("describes browser generic approvals with human-readable rows", () => {
    expect(
      describeGenericActionApproval({
        id: "browser-1",
        category: "browser",
        title: "Browser request /tabs",
        subject: {
          method: "browser.request",
          params: { method: "GET", path: "/tabs", targetId: "tab-1" },
        },
      }),
    ).toMatchObject({
      rows: [
        { label: "Action", value: "browser.request" },
        { label: "Browser method", value: "GET" },
        { label: "Path", value: "/tabs" },
        { label: "Tab", value: "tab-1" },
      ],
    });
  });

  it("describes config generic approvals without exposing only raw JSON", () => {
    expect(
      describeGenericActionApproval({
        id: "config-1",
        category: "config",
        title: "Patch config",
        metadata: {
          subject: {
            actionType: "config.patch",
            baseHash: "abc123",
            note: "Enable feature",
            raw: { messages: { tts: { auto: true } } },
          },
        },
      }).rows,
    ).toEqual([
      { label: "Action", value: "config.patch" },
      { label: "Base hash", value: "abc123" },
      { label: "Note", value: "Enable feature" },
      {
        label: "Patch",
        value: JSON.stringify({ messages: { tts: { auto: true } } }, null, 2),
      },
    ]);
  });

  it("describes external send risk context", () => {
    expect(
      describeGenericActionApproval({
        id: "send-approval",
        category: "message",
        title: "Send email",
        metadata: {
          subject: {
            kind: "email",
            channel: "gmail",
            accountId: "jake",
            target: "customer@example.com",
            subject: "Contract",
            bodyPreview: "Attached is the contract.",
            attachmentPaths: ["/tmp/contract.pdf"],
            impersonatesUser: true,
          },
        },
      }).rows,
    ).toEqual([
      { label: "Send type", value: "email" },
      { label: "Channel", value: "gmail" },
      { label: "Account", value: "jake" },
      { label: "Target", value: "customer@example.com" },
      { label: "Subject", value: "Contract" },
      { label: "Message", value: "Attached is the contract." },
      {
        label: "Attachments",
        value: JSON.stringify(["/tmp/contract.pdf"], null, 2),
      },
      { label: "As user", value: "true" },
    ]);
  });

  it("describes config diff previews with risk and redacted sensitive paths", () => {
    expect(
      describeGenericActionApproval({
        id: "config-2",
        category: "config",
        title: "Patch config",
        metadata: {
          approvalPreview: {
            risk: "high",
            changedPaths: ["providers.openai.apiKey"],
            sensitivePaths: ["providers.openai.apiKey"],
            diff: [
              {
                path: "providers.openai.apiKey",
                kind: "changed",
                sensitive: true,
                before: "[redacted]",
                after: "[redacted]",
              },
            ],
          },
          subject: {
            actionType: "config.patch",
            baseHash: "abc123",
          },
        },
      }).rows,
    ).toEqual([
      { label: "Action", value: "config.patch" },
      { label: "Base hash", value: "abc123" },
      { label: "Risk", value: "high" },
      {
        label: "Changed paths",
        value: JSON.stringify(["providers.openai.apiKey"], null, 2),
      },
      {
        label: "Sensitive paths",
        value: JSON.stringify(["providers.openai.apiKey"], null, 2),
      },
      {
        label: "Diff",
        value: JSON.stringify(
          [
            {
              path: "providers.openai.apiKey",
              kind: "changed",
              sensitive: true,
              before: "[redacted]",
              after: "[redacted]",
            },
          ],
          null,
          2,
        ),
      },
    ]);
  });

  it("renders vault secret approvals as generic redacted approval cards", () => {
    const item = {
      id: "vault-approval",
      category: "credential" as const,
      title: "Vault reveal: OpenAI API Key",
      metadata: {
        actionType: "vault.secret.reveal",
        subject: {
          actionType: "vault.secret.reveal",
          vaultEntryId: "vault_openai_api_key",
          label: "OpenAI API Key",
          provider: "openai",
          fingerprint: "sk-…abcd",
          purpose: "Reveal full secret in Desktop Vault",
        },
      },
    };

    expect(normalizeCredentialFromActionApproval(item)).toBeNull();
    const generic = normalizeGenericActionApproval(item);
    expect(generic).toMatchObject({
      id: "vault-approval",
      category: "credential",
    });
    expect(describeGenericActionApproval(generic!).rows).toEqual([
      { label: "Action", value: "vault.secret.reveal" },
      { label: "Vault action", value: "vault.secret.reveal" },
      { label: "Credential", value: "vault_openai_api_key" },
      { label: "Label", value: "OpenAI API Key" },
      { label: "Provider", value: "openai" },
      { label: "Purpose", value: "Reveal full secret in Desktop Vault" },
    ]);
  });

  it("describes redacted secret descriptors without raw secret values", () => {
    expect(
      describeGenericActionApproval({
        id: "credential-1",
        category: "config",
        title: "Store provider key",
        metadata: {
          actionType: "credential.write",
          secret: {
            kind: "secret-value",
            provider: "openai",
            keyPath: "providers.openai.apiKey",
            valueHash: "abc123",
            redacted: true,
          },
          subject: { actionType: "credential.write" },
        },
      }).rows,
    ).toEqual([
      { label: "Action", value: "credential.write" },
      { label: "Secret", value: "secret-value" },
      { label: "Provider", value: "openai" },
      { label: "Secret path", value: "providers.openai.apiKey" },
      { label: "Value hash", value: "abc123" },
    ]);
  });

  it("normalizes legacy tool invoke approval timestamp fields", () => {
    expect(
      normalizeToolInvokeEvent({
        id: "tool-1",
        tool: "message",
        args: { target: "Jake" },
        requestedAt: "2026-05-11T15:00:00.000Z",
        expiresAt: "2026-05-11T15:02:00.000Z",
      } as never),
    ).toMatchObject({
      id: "tool-1",
      createdAtMs: Date.parse("2026-05-11T15:00:00.000Z"),
      expiresAtMs: Date.parse("2026-05-11T15:02:00.000Z"),
    });
  });

  it("normalizes live Vault import approvals without requiring a subject", () => {
    const normalized = normalizeGenericActionApprovalEvent({
      id: "vault-import-1",
      category: "vault",
      title: "Import OpenAI API key into Vault",
      description: "Import config secret",
      metadata: {
        actionType: "vault.secret.import",
        credentialId: "openai-api-key",
        label: "OpenAI API key",
        sourceKind: "config",
        source: "models.providers.openai.apiKey",
        valuePreview: "sk-a…1234",
        cleanupAction: "redact",
      },
    });

    expect(normalized).toMatchObject({
      id: "vault-import-1",
      category: "vault",
      title: "Import OpenAI API key into Vault",
      metadata: {
        actionType: "vault.secret.import",
        credentialId: "openai-api-key",
        valuePreview: "sk-a…1234",
      },
    });
    expect(JSON.stringify(normalized)).not.toContain("sk-actual-secret");
  });

  it("describes Vault import approvals with source and masked preview only", () => {
    const description = describeGenericActionApproval({
      id: "vault-import-1",
      category: "vault",
      title: "Import OpenAI API key into Vault",
      metadata: {
        actionType: "vault.secret.import",
        credentialId: "openai-api-key",
        label: "OpenAI API key",
        provider: "openai",
        sourceKind: "config",
        source: "models.providers.openai.apiKey",
        valuePreview: "sk-a…1234",
        cleanupAction: "redact",
      },
    });

    expect(description.rows).toEqual(
      expect.arrayContaining([
        { label: "Action", value: "vault.secret.import" },
        { label: "Credential", value: "openai-api-key" },
        { label: "Source", value: "models.providers.openai.apiKey" },
        { label: "Preview", value: "sk-a…1234" },
        { label: "Cleanup", value: "redact" },
      ]),
    );
    expect(JSON.stringify(description)).not.toContain("sk-actual-secret");
  });
});
