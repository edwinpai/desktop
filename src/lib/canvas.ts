import {
  callGatewayMethod,
  signGatewayParams,
  type GatewayTarget,
} from "@/lib/gateway-context";

export { buildGatewayTarget } from "@/lib/gateway-context";

export type CanvasAction =
  | "present"
  | "hide"
  | "navigate"
  | "eval"
  | "snapshot"
  | "a2ui_push"
  | "a2ui_reset";

function canvasCommandForAction(action: CanvasAction): string {
  switch (action) {
    case "present":
      return "canvas.present";
    case "hide":
      return "canvas.hide";
    case "navigate":
      return "canvas.navigate";
    case "eval":
      return "canvas.eval";
    case "snapshot":
      return "canvas.snapshot";
    case "a2ui_push":
      return "canvas.a2ui.pushJSONL";
    case "a2ui_reset":
      return "canvas.a2ui.reset";
    default: {
      const exhaustiveCheck: never = action;
      throw new Error(`Unknown canvas action: ${String(exhaustiveCheck)}`);
    }
  }
}

function buildNodeInvokeParams(
  action: CanvasAction,
  params: Record<string, unknown>,
): Record<string, unknown> {
  switch (action) {
    case "present": {
      const invokeParams: Record<string, unknown> = {};
      if (typeof params.target === "string" && params.target.trim()) {
        invokeParams.url = params.target.trim();
      }
      const placement = {
        x: typeof params.x === "number" ? params.x : undefined,
        y: typeof params.y === "number" ? params.y : undefined,
        width: typeof params.width === "number" ? params.width : undefined,
        height: typeof params.height === "number" ? params.height : undefined,
      };
      if (Object.values(placement).some((value) => typeof value === "number")) {
        invokeParams.placement = placement;
      }
      return invokeParams;
    }
    case "navigate":
      return { url: params.url };
    case "eval":
      return { javaScript: params.javaScript };
    case "snapshot":
      return {
        format:
          params.outputFormat === "jpg"
            ? "jpeg"
            : (params.outputFormat ?? "png"),
        maxWidth: params.maxWidth,
        quality: params.quality,
      };
    case "a2ui_push":
      return { jsonl: params.jsonl };
    case "hide":
    case "a2ui_reset":
    default:
      return {};
  }
}

function imageMimeForFormat(format?: string): string {
  return format === "jpeg" || format === "jpg" ? "image/jpeg" : "image/png";
}

function normalizeCanvasResult(action: CanvasAction, payload: unknown) {
  if (action === "snapshot" && payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>;
    const format = typeof obj.format === "string" ? obj.format : "png";
    const base64 = typeof obj.base64 === "string" ? obj.base64 : null;
    if (base64) {
      return {
        action,
        format,
        base64,
        image: `data:${imageMimeForFormat(format)};base64,${base64}`,
      };
    }
  }

  if (action === "eval" && payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>;
    if (typeof obj.result === "string") {
      return {
        action,
        result: obj.result,
        payload,
      };
    }
  }

  return payload;
}

/**
 * Invoke Canvas commands over the authenticated gateway WebSocket path.
 *
 * Canvas actions are implemented as signed `node.invoke` requests so they work
 * under the current BSV-authenticated desktop control-plane model.
 */
export async function invokeCanvasTool(
  target: GatewayTarget,
  action: CanvasAction,
  params: Record<string, unknown> = {},
  timeoutMs = 30000,
): Promise<unknown> {
  const nodeId = typeof params.node === "string" ? params.node.trim() : "";
  if (!nodeId) {
    throw new Error("Select a canvas-capable node first.");
  }

  const command = canvasCommandForAction(action);
  const invokeParams = buildNodeInvokeParams(action, params);
  const signedParams = await signGatewayParams({
    nodeId,
    command,
    params: invokeParams,
    timeoutMs,
    idempotencyKey: crypto.randomUUID(),
  });

  const raw = (await callGatewayMethod(
    target,
    "node.invoke",
    signedParams,
    timeoutMs,
    `Timed out invoking ${command}`,
  )) as Record<string, unknown>;

  return normalizeCanvasResult(action, raw?.payload ?? raw);
}
