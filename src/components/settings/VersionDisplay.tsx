/**
 * VersionDisplay Component - Group G Implementation
 *
 * Displays app version read from package.json via Tauri.
 * Shows version, build number, and environment.
 */

import { useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { APP_VERSION } from "@/lib/app-version";

export interface VersionDisplayProps {
  /**
   * Display variant
   */
  variant?: "inline" | "badge" | "detailed";

  /**
   * Show environment (development/production)
   */
  showEnvironment?: boolean;

  /**
   * Custom class name
   */
  className?: string;
}

interface VersionInfo {
  version: string;
  environment: "development" | "production";
}

/**
 * Version display component
 *
 * @example
 * ```tsx
 * <VersionDisplay variant="inline" />
 * <VersionDisplay variant="badge" showEnvironment />
 * <VersionDisplay variant="detailed" />
 * ```
 */
export function VersionDisplay({
  variant = "inline",
  showEnvironment = false,
  className,
}: VersionDisplayProps) {
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadVersion() {
      try {
        const version = await getVersion();
        const environment =
          import.meta.env.MODE === "production" ? "production" : "development";

        if (mounted) {
          setVersionInfo({ version, environment });
          setIsLoading(false);
        }
      } catch (error) {
        console.error("Failed to load version:", error);
        if (mounted) {
          // Fallback to package.json version
          setVersionInfo({
            version: APP_VERSION,
            environment:
              import.meta.env.MODE === "production"
                ? "production"
                : "development",
          });
          setIsLoading(false);
        }
      }
    }

    void loadVersion();

    return () => {
      mounted = false;
    };
  }, []);

  if (isLoading) {
    return <Skeleton className="h-5 w-20" />;
  }

  if (!versionInfo) {
    return null;
  }

  if (variant === "badge") {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Badge variant="outline" aria-label={`Version ${versionInfo.version}`}>
          v{versionInfo.version}
        </Badge>
        {showEnvironment && (
          <Badge
            variant={
              versionInfo.environment === "production" ? "default" : "secondary"
            }
            aria-label={`Environment: ${versionInfo.environment}`}
          >
            {versionInfo.environment}
          </Badge>
        )}
      </div>
    );
  }

  if (variant === "detailed") {
    return (
      <div className={`space-y-1 text-sm ${className}`}>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Version:</span>
          <span className="font-mono">{versionInfo.version}</span>
        </div>
        {showEnvironment && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Environment:</span>
            <Badge
              variant={
                versionInfo.environment === "production"
                  ? "default"
                  : "secondary"
              }
              className="h-5"
            >
              {versionInfo.environment}
            </Badge>
          </div>
        )}
      </div>
    );
  }

  // Default: inline variant
  return (
    <span className={`text-sm text-muted-foreground ${className}`}>
      v{versionInfo.version}
      {showEnvironment && (
        <span className="ml-2">({versionInfo.environment})</span>
      )}
    </span>
  );
}

/**
 * Hook for accessing version information
 */
export function useVersion() {
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadVersion() {
      try {
        const version = await getVersion();
        const environment =
          import.meta.env.MODE === "production" ? "production" : "development";

        if (mounted) {
          setVersionInfo({ version, environment });
          setIsLoading(false);
        }
      } catch (error) {
        console.error("Failed to load version:", error);
        if (mounted) {
          setVersionInfo({
            version: APP_VERSION,
            environment:
              import.meta.env.MODE === "production"
                ? "production"
                : "development",
          });
          setIsLoading(false);
        }
      }
    }

    void loadVersion();

    return () => {
      mounted = false;
    };
  }, []);

  return { versionInfo, isLoading };
}
