/**
 * EmptyState Component - Group G Implementation
 *
 * Zero-data state placeholder with icon, message, and optional action.
 * Provides consistent UX for empty lists, searches, and initial states.
 */

import { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  /**
   * Icon to display (Lucide icon component)
   */
  icon?: LucideIcon;

  /**
   * Main heading text
   */
  title: string;

  /**
   * Descriptive text explaining the empty state
   */
  description?: string;

  /**
   * Optional action button
   */
  action?: {
    label: string;
    onClick: () => void;
    variant?: "default" | "outline" | "secondary";
  };

  /**
   * Additional CSS classes
   */
  className?: string;

  /**
   * Icon color theme
   */
  iconColor?: "muted" | "primary" | "destructive";
}

/**
 * EmptyState component for zero-data views
 *
 * @example
 * ```tsx
 * <EmptyState
 *   icon={Inbox}
 *   title="No messages yet"
 *   description="Start a conversation to see messages here"
 *   action={{
 *     label: "New Message",
 *     onClick: handleNewMessage
 *   }}
 * />
 * ```
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  iconColor = "muted",
}: EmptyStateProps) {
  const iconColorClass = {
    muted: "text-muted-foreground",
    primary: "text-primary",
    destructive: "text-destructive",
  }[iconColor];

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center p-8 space-y-4",
        className
      )}
      role="status"
      aria-label={title}
    >
      {Icon && (
        <div
          className={cn("rounded-full bg-muted/50 p-6", iconColorClass)}
          aria-hidden="true"
        >
          <Icon className="size-12" />
        </div>
      )}

      <div className="space-y-2 max-w-md">
        <h3 className="text-lg font-semibold">{title}</h3>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>

      {action && (
        <Button
          variant={action.variant ?? "default"}
          onClick={action.onClick}
          aria-label={action.label}
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}
