import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useConfig } from "@/hooks/useConfig";
import {
  buildGatewayTarget,
  invokeSkillTool,
  type SkillStatusEntry,
  type SkillStatusReport,
} from "@/lib/skills";

const joinList = (items: string[]) => items.filter(Boolean).join(", ");

function toUserFacingError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (
    msg.includes("Cannot read properties of undefined (reading 'invoke')") ||
    msg.includes("Failed to initialize configuration")
  ) {
    return "Desktop integration is unavailable right now. Please reopen this screen inside the desktop app.";
  }
  if (
    msg.includes("unknown method") ||
    msg.includes("not found") ||
    msg.includes("does not exist")
  ) {
    return "This gateway does not support desktop skill management yet.";
  }
  return msg;
}

export function SkillsPanel({ embedded = false }: { embedded?: boolean } = {}) {
  const { config, loading: configLoading } = useConfig();
  const target = useMemo(() => buildGatewayTarget(config), [config]);

  const [report, setReport] = useState<SkillStatusReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [apiKeyDrafts, setApiKeyDrafts] = useState<Record<string, string>>({});

  const loadSkills = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = (await invokeSkillTool(
        target,
        "status",
      )) as SkillStatusReport;
      setReport(result);
    } catch (err) {
      setError(toUserFacingError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (configLoading) return;
    void loadSkills();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configLoading, target.url, target.token]);

  const updateSkill = async (skillKey: string, enabled: boolean) => {
    setBusyKey(skillKey);
    setError(null);
    try {
      await invokeSkillTool(target, "update", { skillKey, enabled });
      await loadSkills();
    } catch (err) {
      setError(toUserFacingError(err));
    } finally {
      setBusyKey(null);
    }
  };

  const saveApiKey = async (skillKey: string) => {
    setBusyKey(skillKey);
    setError(null);
    try {
      const apiKey = apiKeyDrafts[skillKey] ?? "";
      await invokeSkillTool(target, "update", { skillKey, apiKey });
      await loadSkills();
    } catch (err) {
      setError(toUserFacingError(err));
    } finally {
      setBusyKey(null);
    }
  };

  const installSkill = async (skill: SkillStatusEntry) => {
    const option = skill.install?.[0];
    if (!option) return;
    setBusyKey(skill.skillKey);
    setError(null);
    try {
      await invokeSkillTool(
        target,
        "install",
        {
          name: skill.name,
          installId: option.id,
          timeoutMs: 120000,
        },
        120000,
      );
      await loadSkills();
    } catch (err) {
      setError(toUserFacingError(err));
    } finally {
      setBusyKey(null);
    }
  };

  if (configLoading) {
    return (
      <div className="p-6 text-muted-foreground">Loading gateway config...</div>
    );
  }

  return (
    <div className={embedded ? "space-y-6" : "p-6 space-y-6"}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Skills</h2>
          <p className="text-sm text-muted-foreground">
            Manage skill availability and gateway-side requirements.
          </p>
        </div>
        <Button variant="outline" onClick={loadSkills} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      {error && <div className="text-sm text-destructive">{error}</div>}

      {report?.skills?.length ? (
        <div className="grid gap-4">
          {report.skills.map((skill) => {
            const missing = [
              skill.missing.bins.length
                ? `Bins: ${joinList(skill.missing.bins)}`
                : null,
              skill.missing.anyBins.length
                ? `Any bins: ${joinList(skill.missing.anyBins)}`
                : null,
              skill.missing.env.length
                ? `Env: ${joinList(skill.missing.env)}`
                : null,
              skill.missing.config.length
                ? `Config: ${joinList(skill.missing.config)}`
                : null,
              skill.missing.os.length
                ? `OS: ${joinList(skill.missing.os)}`
                : null,
            ].filter(Boolean);

            return (
              <Card key={skill.skillKey}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <span>
                          {skill.emoji ? `${skill.emoji} ` : ""}
                          {skill.name}
                        </span>
                        {skill.bundled && (
                          <Badge variant="secondary">Bundled</Badge>
                        )}
                        {skill.always && (
                          <Badge variant="outline">Always on</Badge>
                        )}
                        {skill.blockedByAllowlist && (
                          <Badge variant="destructive">Blocked</Badge>
                        )}
                      </CardTitle>
                      <CardDescription>{skill.description}</CardDescription>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-xs text-muted-foreground">
                        {skill.eligible ? "Eligible" : "Needs setup"}
                      </div>
                      <Switch
                        checked={!skill.disabled}
                        onCheckedChange={(checked) =>
                          updateSkill(skill.skillKey, checked)
                        }
                        disabled={
                          skill.always ||
                          skill.blockedByAllowlist ||
                          busyKey === skill.skillKey
                        }
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {missing.length > 0 && (
                    <div className="text-sm text-muted-foreground">
                      Missing: {missing.join(" • ")}
                    </div>
                  )}

                  {skill.install?.length > 0 &&
                    !skill.eligible &&
                    !skill.blockedByAllowlist && (
                      <Button
                        variant="outline"
                        onClick={() => installSkill(skill)}
                        disabled={busyKey === skill.skillKey}
                      >
                        {busyKey === skill.skillKey
                          ? "Installing..."
                          : (skill.install[0]?.label ?? "Install")}
                      </Button>
                    )}

                  {skill.primaryEnv && (
                    <div className="space-y-2">
                      <Label htmlFor={`${skill.skillKey}-apikey`}>
                        {skill.primaryEnv}
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          id={`${skill.skillKey}-apikey`}
                          value={apiKeyDrafts[skill.skillKey] ?? ""}
                          onChange={(e) =>
                            setApiKeyDrafts((prev) => ({
                              ...prev,
                              [skill.skillKey]: e.target.value,
                            }))
                          }
                          placeholder="Enter API key"
                        />
                        <Button
                          onClick={() => saveApiKey(skill.skillKey)}
                          disabled={busyKey === skill.skillKey}
                        >
                          Save
                        </Button>
                      </div>
                    </div>
                  )}

                  {skill.homepage && (
                    <a
                      className="text-xs text-muted-foreground underline"
                      href={skill.homepage}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {skill.homepage}
                    </a>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No skills found</CardTitle>
            <CardDescription>
              Ensure the gateway has skills available or check your workspace
              configuration.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}
