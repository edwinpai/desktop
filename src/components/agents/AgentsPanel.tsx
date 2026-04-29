import { Bot, CheckCircle, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Agent {
  id: string;
  name?: string;
}

interface AgentsPanelProps {
  agents: Agent[];
  currentAgentId: string;
  onSelectAgent?: (id: string) => void;
  request?: (method: string, params: Record<string, unknown>) => Promise<unknown>;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function AgentsPanel({
  agents,
  currentAgentId,
  onSelectAgent,
}: AgentsPanelProps) {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6" />
            Agents
          </h2>
          <p className="text-sm text-muted-foreground">
            {agents.length} agent{agents.length !== 1 ? "s" : ""} available
          </p>
        </div>
      </div>

      {/* Agent cards */}
      {agents.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No agents found</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              No agents are currently configured. Check your gateway connection.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {agents.map((agent) => {
            const isActive = agent.id === currentAgentId;

            return (
              <Card
                key={agent.id}
                className={cn(
                  "transition-colors",
                  isActive && "border-primary/50 bg-primary/5"
                )}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-4">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Bot className="h-4 w-4" />
                      {agent.name || agent.id}
                      {isActive && (
                        <Badge variant="secondary" className="flex items-center gap-1">
                          <CheckCircle className="h-3 w-3" />
                          Active
                        </Badge>
                      )}
                    </CardTitle>
                    {!isActive && onSelectAgent && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onSelectAgent(agent.id)}
                      >
                        Select
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-xs text-muted-foreground font-mono">
                    {agent.id}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
