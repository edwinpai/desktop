/**
 * AppLayout - App shell with navigation
 *
 * Provides:
 * - Sidebar navigation
 * - Top bar with identity/status
 * - Main content area
 * - Responsive layout
 */

import { ReactNode } from 'react';
import { Navigation } from './Navigation';
import { TopBar } from './TopBar';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      {/* Top bar */}
      <TopBar />

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar navigation */}
        <Navigation />

        {/* Main content area */}
        <main className="flex-1 overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
