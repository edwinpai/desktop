/**
 * Desktop-side subagent delegation helpers.
 *
 * Mirrors the stable-JSON and delegation payload logic from the core
 * `src/agents/subagent-delegation.ts` so the Desktop can construct a
 * verifiable delegation payload before calling `sign_request`.
 */

export type SubagentDelegationPayload = {
  kind: "subagent-delegation";
  version: 1;
  sessionKey: string;
  taskId: string;
  proposalId: string;
  agentTypeId: string;
  approvedAt: string;
  approvalRequestId: string;
  disciplineId?: string;
  profileId?: string;
  scopeHash?: string;
};

/**
 * Deterministic JSON serialization with sorted keys and no undefined values.
 * Must produce the same output as the core `stableJson` used to hash payloads.
 */
export function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value))
    return `[${value.map((item) => stableJson(item)).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
    .join(",")}}`;
}

/** SHA-256 of a UTF-8 string, returned as a lowercase hex string. */
export async function sha256hex(str: string): Promise<string> {
  const encoded = new TextEncoder().encode(str);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Build the delegation payload that will be signed by the Desktop operator key.
 * The payload fields and serialization must match `buildSubagentDelegationPayload`
 * in core `src/agents/subagent-delegation.ts`.
 */
export async function buildSubagentDelegationPayload(input: {
  sessionKey: string;
  taskId: string;
  proposalId: string;
  agentTypeId: string;
  approvalRequestId: string;
  approvedAt: string;
  disciplineId?: string;
  profileId?: string;
  scope?: unknown;
}): Promise<SubagentDelegationPayload> {
  const scopeHash = input.scope
    ? await sha256hex(stableJson(input.scope))
    : undefined;
  return {
    kind: "subagent-delegation",
    version: 1,
    sessionKey: input.sessionKey,
    taskId: input.taskId,
    proposalId: input.proposalId,
    agentTypeId: input.agentTypeId,
    approvedAt: input.approvedAt,
    approvalRequestId: input.approvalRequestId,
    disciplineId: input.disciplineId,
    profileId: input.profileId,
    scopeHash,
  };
}
