import { callGatewayMethod, type GatewayTarget } from "@/lib/gateway-context";

export { buildGatewayTarget } from "@/lib/gateway-context";

export type SkillStatusEntry = {
  name: string;
  description: string;
  source: string;
  bundled: boolean;
  filePath: string;
  baseDir: string;
  skillKey: string;
  primaryEnv?: string;
  emoji?: string;
  homepage?: string;
  always: boolean;
  disabled: boolean;
  blockedByAllowlist: boolean;
  eligible: boolean;
  requirements: {
    bins: string[];
    anyBins: string[];
    env: string[];
    config: string[];
    os: string[];
  };
  missing: {
    bins: string[];
    anyBins: string[];
    env: string[];
    config: string[];
    os: string[];
  };
  install: Array<{
    id: string;
    kind: string;
    label: string;
    bins: string[];
  }>;
};

export type SkillStatusReport = {
  workspaceDir: string;
  managedSkillsDir: string;
  skills: SkillStatusEntry[];
};

type SkillAction = "status" | "install" | "update";

/**
 * Invoke a skills method via the gateway WebSocket protocol.
 *
 * Maps actions to gateway methods:
 *   status  → skills.status
 *   install → skills.install
 *   update  → skills.update
 */
export async function invokeSkillTool(
  target: GatewayTarget,
  action: SkillAction,
  params: Record<string, unknown> = {},
  timeoutMs = 10000,
): Promise<unknown> {
  return callGatewayMethod(
    target,
    `skills.${action}`,
    params,
    timeoutMs,
    `Timed out invoking skills.${action}`,
  );
}
