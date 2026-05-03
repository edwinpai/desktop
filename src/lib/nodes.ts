import {
  callGatewayMethod,
  signGatewayParams,
  type GatewayTarget,
} from "@/lib/gateway-context";

export { buildGatewayTarget } from "@/lib/gateway-context";

export type NodeListNode = {
  nodeId: string;
  displayName?: string;
  platform?: string;
  version?: string;
  coreVersion?: string;
  uiVersion?: string;
  remoteIp?: string;
  deviceFamily?: string;
  modelIdentifier?: string;
  pathEnv?: string;
  caps?: string[];
  commands?: string[];
  permissions?: Record<string, boolean>;
  paired?: boolean;
  connected?: boolean;
  connectedAtMs?: number;
};

export type PendingRequest = {
  requestId: string;
  nodeId: string;
  displayName?: string;
  platform?: string;
  version?: string;
  coreVersion?: string;
  uiVersion?: string;
  remoteIp?: string;
  isRepair?: boolean;
  ts: number;
};

export type PairedNode = {
  nodeId: string;
  token?: string;
  displayName?: string;
  platform?: string;
  version?: string;
  coreVersion?: string;
  uiVersion?: string;
  remoteIp?: string;
  permissions?: Record<string, boolean>;
  createdAtMs?: number;
  approvedAtMs?: number;
  lastConnectedAtMs?: number;
};

export type NodeStatusReport = { nodes: NodeListNode[] };
export type PairingReport = { pending: PendingRequest[]; paired: PairedNode[] };

type NodesAction =
  | "status"
  | "pending"
  | "approve"
  | "reject"
  | "notify"
  | "camera_snap"
  | "camera_clip"
  | "screen_record"
  | "location_get";

/**
 * Map Desktop node actions → gateway WebSocket methods + params.
 */
function resolveWsCall(
  action: NodesAction,
  params: Record<string, unknown>,
): { method: string; params: Record<string, unknown> } {
  switch (action) {
    case "status":
      return { method: "node.list", params: {} };
    case "pending":
      return { method: "node.pair.list", params: {} };
    case "approve":
      return {
        method: "node.pair.approve",
        params: { requestId: params.requestId as string },
      };
    case "reject":
      return {
        method: "node.pair.reject",
        params: { requestId: params.requestId as string },
      };
    case "notify":
      return {
        method: "node.invoke",
        params: {
          nodeId: params.node as string,
          command: "notify",
          paramsJson: JSON.stringify({
            title: params.title,
            body: params.body,
            sound: params.sound,
            priority: params.priority,
          }),
        },
      };
    case "camera_snap":
      return {
        method: "node.invoke",
        params: {
          nodeId: params.node as string,
          command: "camera_snap",
          paramsJson: JSON.stringify({ facing: params.facing }),
        },
      };
    case "camera_clip":
      return {
        method: "node.invoke",
        params: {
          nodeId: params.node as string,
          command: "camera_clip",
          paramsJson: JSON.stringify({
            facing: params.facing,
            durationMs: params.durationMs,
          }),
        },
      };
    case "screen_record":
      return {
        method: "node.invoke",
        params: {
          nodeId: params.node as string,
          command: "screen_record",
          paramsJson: JSON.stringify({ durationMs: params.durationMs }),
        },
      };
    case "location_get":
      return {
        method: "node.invoke",
        params: {
          nodeId: params.node as string,
          command: "location_get",
          paramsJson: JSON.stringify({}),
        },
      };
    default:
      throw new Error(`Unknown nodes action: ${action}`);
  }
}

/**
 * Invoke a nodes-related gateway method via WebSocket.
 */
export async function invokeNodesTool(
  target: GatewayTarget,
  action: NodesAction,
  params: Record<string, unknown> = {},
  timeoutMs = 15000,
): Promise<unknown> {
  const { method, params: wsParams } = resolveWsCall(action, params);
  const signedParams =
    method === "node.invoke" ? await signGatewayParams(wsParams) : wsParams;
  return callGatewayMethod(
    target,
    method,
    signedParams,
    timeoutMs,
    `Timed out invoking ${method}`,
  );
}
