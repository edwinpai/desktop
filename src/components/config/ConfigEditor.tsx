import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { RefreshCw, Save, CheckCircle, AlertCircle } from "lucide-react";

interface ConfigEditorProps {
  request?: (method: string, params: Record<string, unknown>) => Promise<unknown>;
}

interface ConfigData {
  gatewayUrl: string;
  gatewayToken: string;
  defaultModel: string;
  defaultThinkingLevel: string;
  maxTokens: number;
  systemPrompt: string;
  historyLimit: number;
  streamMode: string;
  [key: string]: unknown;
}

const DEFAULT_CONFIG: ConfigData = {
  gatewayUrl: "http://localhost:18789",
  gatewayToken: "",
  defaultModel: "claude-sonnet-4-20250514",
  defaultThinkingLevel: "normal",
  maxTokens: 4096,
  systemPrompt: "",
  historyLimit: 50,
  streamMode: "chunked",
};

interface FormField {
  key: keyof ConfigData;
  label: string;
  type: "text" | "password" | "number";
  placeholder?: string;
  help?: string;
}

const FORM_FIELDS: FormField[] = [
  {
    key: "gatewayUrl",
    label: "Gateway URL",
    type: "text",
    placeholder: "http://localhost:18789",
    help: "The URL of the EdwinPAI gateway to connect to",
  },
  {
    key: "gatewayToken",
    label: "Gateway Token",
    type: "password",
    placeholder: "Enter token",
    help: "Authentication token for the gateway",
  },
  {
    key: "defaultModel",
    label: "Default Model",
    type: "text",
    placeholder: "claude-sonnet-4-20250514",
    help: "Default AI model for new sessions",
  },
  {
    key: "defaultThinkingLevel",
    label: "Thinking Level",
    type: "text",
    placeholder: "normal",
    help: "Default thinking/reasoning level (e.g. none, normal, extended)",
  },
  {
    key: "maxTokens",
    label: "Max Tokens",
    type: "number",
    placeholder: "4096",
    help: "Maximum token count for responses",
  },
  {
    key: "systemPrompt",
    label: "System Prompt",
    type: "text",
    placeholder: "Optional system prompt",
    help: "Default system prompt prepended to conversations",
  },
  {
    key: "historyLimit",
    label: "History Limit",
    type: "number",
    placeholder: "50",
    help: "Maximum number of messages to retain in context",
  },
  {
    key: "streamMode",
    label: "Stream Mode",
    type: "text",
    placeholder: "chunked",
    help: "Response streaming mode (chunked or live)",
  },
];

export function ConfigEditor({ request }: ConfigEditorProps) {
  const [config, setConfig] = useState<ConfigData>({ ...DEFAULT_CONFIG });
  const [jsonText, setJsonText] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    setStatus(null);
    try {
      if (request) {
        const result = (await request("getConfig", {})) as Record<string, unknown>;
        const merged = { ...DEFAULT_CONFIG, ...result } as ConfigData;
        setConfig(merged);
        setJsonText(JSON.stringify(merged, null, 2));
      } else {
        // No request function - use defaults
        setConfig({ ...DEFAULT_CONFIG });
        setJsonText(JSON.stringify(DEFAULT_CONFIG, null, 2));
      }
    } catch (err) {
      setStatus({
        type: "error",
        message: `Failed to load config: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  const handleFormChange = (key: keyof ConfigData, value: string | number) => {
    setConfig((prev) => {
      const updated = { ...prev, [key]: value };
      setJsonText(JSON.stringify(updated, null, 2));
      return updated;
    });
  };

  const handleJsonSave = async () => {
    setSaving(true);
    setStatus(null);
    try {
      const parsed = JSON.parse(jsonText) as ConfigData;
      setConfig(parsed);

      if (request) {
        await request("setConfig", { config: parsed });
      }

      setStatus({ type: "success", message: "Configuration saved." });
    } catch (err) {
      setStatus({
        type: "error",
        message: err instanceof SyntaxError
          ? `Invalid JSON: ${err.message}`
          : `Failed to save: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleFormSave = async () => {
    setSaving(true);
    setStatus(null);
    try {
      if (request) {
        await request("setConfig", { config });
      }
      setJsonText(JSON.stringify(config, null, 2));
      setStatus({ type: "success", message: "Configuration saved." });
    } catch (err) {
      setStatus({
        type: "error",
        message: `Failed to save: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Configuration</h2>
          <p className="text-sm text-muted-foreground">
            View and edit gateway and session defaults.
          </p>
        </div>
        <Button variant="outline" onClick={loadConfig} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
          Reload
        </Button>
      </div>

      {/* Status */}
      {status && (
        <div
          className={`flex items-center gap-2 text-sm rounded-md px-3 py-2 ${
            status.type === "success"
              ? "text-green-600 bg-green-500/10"
              : "text-destructive bg-destructive/10"
          }`}
        >
          {status.type === "success" ? (
            <CheckCircle className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          {status.message}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Tabs defaultValue="form">
          <TabsList>
            <TabsTrigger value="form">Form</TabsTrigger>
            <TabsTrigger value="json">JSON</TabsTrigger>
          </TabsList>

          {/* Form view */}
          <TabsContent value="form">
            <Card className="p-6">
              <div className="space-y-5">
                {FORM_FIELDS.map((field) => (
                  <div key={field.key} className="space-y-1.5">
                    <Label htmlFor={`config-${field.key}`}>{field.label}</Label>
                    <Input
                      id={`config-${field.key}`}
                      type={field.type}
                      placeholder={field.placeholder}
                      value={config[field.key] as string | number}
                      onChange={(e) => {
                        const val =
                          field.type === "number"
                            ? parseInt(e.target.value, 10) || 0
                            : e.target.value;
                        handleFormChange(field.key, val);
                      }}
                    />
                    {field.help && (
                      <p className="text-xs text-muted-foreground">{field.help}</p>
                    )}
                  </div>
                ))}

                <Button onClick={handleFormSave} disabled={saving} className="w-full mt-2">
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </Card>
          </TabsContent>

          {/* JSON view */}
          <TabsContent value="json">
            <Card className="p-6 space-y-4">
              <Textarea
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                className="font-mono text-sm min-h-[320px]"
                spellCheck={false}
              />
              <Button onClick={handleJsonSave} disabled={saving} className="w-full">
                <Save className="h-4 w-4 mr-2" />
                {saving ? "Saving..." : "Save JSON"}
              </Button>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
