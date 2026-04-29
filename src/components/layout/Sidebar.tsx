/**
 * Navigation Sidebar Component
 *
 * Main navigation sidebar with gateway status indicator
 */

import { GatewayStatusIndicator } from "@/components/shared/GatewayStatusIndicator";
import { APP_VERSION } from "@/lib/app-version";

export function Sidebar() {
  return (
    <aside className="w-64 border-r bg-muted/30 flex flex-col">
      <div className="p-4 border-b">
        <h1 className="text-lg font-semibold">EdwinPAI Desktop</h1>
        <div className="mt-2">
          <GatewayStatusIndicator />
        </div>
      </div>

      <nav className="flex-1 p-2">
        {/* Navigation items will be added here */}
      </nav>

      <div className="p-4 border-t">
        <p className="text-xs text-muted-foreground">Version {APP_VERSION}</p>
      </div>
    </aside>
  );
}
