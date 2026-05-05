import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

interface RuntimeCheck {
  installed: boolean;
  compatible: boolean;
  expectedVersion: string;
  version?: string | null;
  binaryPath?: string | null;
  gatewayStatusOk: boolean;
  gatewayStatus?: string | null;
  reason?: string | null;
}

interface RuntimeCommandResult {
  success: boolean;
  code?: number | null;
  stdout: string;
  stderr: string;
}

export function RuntimeInstallerGate({
  onReady,
  onCancel,
}: {
  onReady: () => void;
  onCancel: () => void;
}) {
  const [check, setCheck] = useState<RuntimeCheck | null>(null);
  const [checking, setChecking] = useState(true);
  const [installing, setInstalling] = useState(false);
  const [starting, setStarting] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [log, setLog] = useState("");
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setChecking(true);
    setError(null);
    try {
      const result = await invoke<RuntimeCheck>("check_edwinpai_runtime");
      setCheck(result);
      if (result.installed && result.compatible) {
        onReady();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const install = async () => {
    setInstalling(true);
    setError(null);
    setShowDetails(true);
    setLog((prev) => `${prev}\nStarting EdwinPAI runtime installer...\n`);
    try {
      const result = await invoke<RuntimeCommandResult>(
        "install_edwinpai_runtime",
      );
      setLog((prev) =>
        [
          prev,
          result.stdout,
          result.stderr ? `\n[stderr]\n${result.stderr}` : "",
          `\nInstaller exited with ${result.code ?? "unknown"}.`,
        ].join(""),
      );
      if (!result.success) {
        setError("Installer did not complete successfully. Review details below.");
        return;
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setInstalling(false);
    }
  };

  const startGateway = async () => {
    setStarting(true);
    setError(null);
    setShowDetails(true);
    try {
      const result = await invoke<RuntimeCommandResult>(
        "start_edwinpai_gateway_cli",
      );
      setLog((prev) =>
        [
          prev,
          "\nStarting EdwinPAI gateway...\n",
          result.stdout,
          result.stderr ? `\n[stderr]\n${result.stderr}` : "",
        ].join(""),
      );
      if (!result.success) {
        setError("Gateway did not start cleanly. Review details below.");
        return;
      }
      onReady();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setStarting(false);
    }
  };

  const statusText = checking
    ? "Checking EdwinPAI runtime..."
    : check?.installed
      ? check.compatible
        ? "EdwinPAI runtime is installed."
        : "EdwinPAI runtime needs attention."
      : "EdwinPAI runtime is not installed.";

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-3xl rounded-xl border bg-card text-card-foreground shadow-lg">
        <div className="p-6 border-b">
          <p className="text-sm font-medium text-primary mb-2">
            EdwinPAI Desktop setup
          </p>
          <h1 className="text-2xl font-bold mb-2">
            Install the local EdwinPAI runtime
          </h1>
          <p className="text-muted-foreground">
            The desktop app uses a local EdwinPAI runtime for the gateway,
            memory, workflows, tools, plugins, and device/browser integrations.
          </p>
        </div>

        <div className="p-6 space-y-4">
          <div className="rounded-lg border p-4 bg-muted/30">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-semibold">{statusText}</h2>
                {check?.reason && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {check.reason}
                  </p>
                )}
                {check?.version && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Installed: {check.version} · Expected: {check.expectedVersion}
                  </p>
                )}
                {check?.binaryPath && (
                  <p className="text-xs text-muted-foreground mt-1 break-all">
                    {check.binaryPath}
                  </p>
                )}
              </div>
              <button
                type="button"
                className="px-3 py-2 rounded-md border hover:bg-accent text-sm"
                onClick={refresh}
                disabled={checking || installing || starting}
              >
                Recheck
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="px-4 py-2 rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
              onClick={install}
              disabled={checking || installing || starting}
            >
              {installing ? "Installing..." : "Install EdwinPAI"}
            </button>
            {check?.installed && (
              <button
                type="button"
                className="px-4 py-2 rounded-md border hover:bg-accent disabled:opacity-50"
                onClick={startGateway}
                disabled={checking || installing || starting}
              >
                {starting ? "Starting..." : "Start gateway"}
              </button>
            )}
            <button
              type="button"
              className="px-4 py-2 rounded-md border hover:bg-accent"
              onClick={() => setShowDetails((v) => !v)}
            >
              {showDetails ? "Hide details" : "View details"}
            </button>
            <button
              type="button"
              className="px-4 py-2 rounded-md border hover:bg-accent"
              onClick={onReady}
              disabled={installing || starting}
            >
              Choose existing install
            </button>
            <button
              type="button"
              className="px-4 py-2 rounded-md text-muted-foreground hover:bg-accent"
              onClick={onCancel}
              disabled={installing || starting}
            >
              Cancel
            </button>
          </div>

          {showDetails && (
            <div className="space-y-3">
              <div className="rounded-md border p-3 text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-1">
                  What this installs
                </p>
                <p>
                  The bundled installer runs the canonical EdwinPAI installer
                  when available, falling back to the npm beta runtime package.
                  It verifies the CLI and gateway commands before returning.
                </p>
              </div>
              <pre className="max-h-72 overflow-auto rounded-md bg-black text-white text-xs p-3 whitespace-pre-wrap">
                {log || check?.gatewayStatus || "No installer output yet."}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
