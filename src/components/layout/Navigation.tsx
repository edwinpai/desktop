/**
 * Navigation - Sidebar navigation
 *
 * Features:
 * - Navigation links with icons
 * - Active route highlighting
 * - Collapsible sidebar
 * - Conversation list
 */

import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  MessageSquare,
  Settings,
  UserCircle,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  Plus,
} from 'lucide-react';
import type { AppRoute } from '@/types/navigation';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { APP_VERSION } from '@/lib/app-version';

interface NavItem {
  label: string;
  route: AppRoute;
  icon: typeof MessageSquare;
}

const NAV_ITEMS: NavItem[] = [
  {
    label: 'Chat',
    route: '/chat',
    icon: MessageSquare,
  },
  {
    label: 'Subscription',
    route: '/subscription/status',
    icon: CreditCard,
  },
  {
    label: 'Identity',
    route: '/settings/identity',
    icon: UserCircle,
  },
  {
    label: 'Settings',
    route: '/settings',
    icon: Settings,
  },
];

export function Navigation() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (route: AppRoute) => {
    return location.pathname === route || location.pathname.startsWith(route + '/');
  };

  return (
    <nav
      className={cn(
        'flex flex-col border-r bg-card transition-all duration-200',
        isCollapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b px-3">
        {!isCollapsed && (
          <h2 className="text-sm font-semibold text-muted-foreground">
            Navigation
          </h2>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="h-8 w-8"
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Navigation items */}
      <div className="flex-1 space-y-1 p-2">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.route);

          return (
            <Button
              key={item.route}
              variant={active ? 'secondary' : 'ghost'}
              onClick={() => navigate(item.route)}
              className={cn(
                'w-full justify-start',
                isCollapsed && 'justify-center px-2'
              )}
              title={isCollapsed ? item.label : undefined}
            >
              <Icon className={cn('h-4 w-4', !isCollapsed && 'mr-2')} />
              {!isCollapsed && <span>{item.label}</span>}
            </Button>
          );
        })}

        {/* New conversation button */}
        <div className="pt-2">
          <Button
            variant="outline"
            onClick={() => navigate('/chat/new')}
            className={cn(
              'w-full justify-start',
              isCollapsed && 'justify-center px-2'
            )}
            title={isCollapsed ? 'New conversation' : undefined}
          >
            <Plus className={cn('h-4 w-4', !isCollapsed && 'mr-2')} />
            {!isCollapsed && <span>New Chat</span>}
          </Button>
        </div>
      </div>

      {/* Footer */}
      {!isCollapsed && (
        <div className="border-t p-3">
          <div className="text-xs text-muted-foreground">
            EdwinPAI Desktop v{APP_VERSION}
          </div>
        </div>
      )}
    </nav>
  );
}
