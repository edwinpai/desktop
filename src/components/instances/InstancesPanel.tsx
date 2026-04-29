import { useState, useCallback } from "react";
import { RefreshCw, Monitor, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface InstancesPanelProps {
  request?: (method: string, params: Record<string, unknown>) => Promise<unknown>;
}

export function InstancesPanel({ request }: InstancesPanelProps) {
  void request;
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(
    "Instances view is not wired yet — the gateway does not currently expose instances.list.",
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    setMessage("Instances view is not wired yet — the gateway does not currently expose instances.list.");
    setLoading(false);
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6" />
            Instances
          </h2>
          <p className="text-sm text-muted-foreground">
            Desktop-side placeholder until the gateway exposes a real instances listing API.
          </p>
        </div>
        <Button variant="outline" onClick={refresh} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Checking..." : "Check again"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Monitor className="h-5 w-5 text-muted-foreground" />
                Not implemented yet
              </CardTitle>
              <CardDescription>
                This tab was previously calling a nonexistent gateway method and now fails closed instead of throwing.
              </CardDescription>
            </div>
            <Badge variant="outline">Gated</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {message}
          </p>
          <p className="text-xs text-muted-foreground">
            Next step: either add an <code>instances.list</code> gateway method or hide this tab until the backend exists.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
