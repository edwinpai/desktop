/**
 * Skeleton Component - Group G Implementation
 *
 * Loading state placeholder with shimmer animation.
 * Follows shadcn/ui patterns for consistency.
 */

import { cn } from "@/lib/utils";

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Variant determines the shimmer animation style
   */
  variant?: "default" | "pulse" | "wave";
}

/**
 * Skeleton loading component
 *
 * @example
 * ```tsx
 * <Skeleton className="h-12 w-full" />
 * <Skeleton variant="pulse" className="h-4 w-64" />
 * ```
 */
export function Skeleton({
  className,
  variant = "default",
  ...props
}: SkeletonProps) {
  return (
    <div
      className={cn(
        "rounded-md bg-muted",
        variant === "default" && "animate-pulse",
        variant === "pulse" && "animate-pulse",
        variant === "wave" &&
          "animate-shimmer bg-gradient-to-r from-muted via-muted-foreground/10 to-muted bg-[length:200%_100%]",
        className
      )}
      role="status"
      aria-label="Loading..."
      {...props}
    />
  );
}

/**
 * Skeleton variants for common use cases
 */
export const SkeletonVariants = {
  /**
   * Text line skeleton
   */
  Text: ({ className, ...props }: SkeletonProps) => (
    <Skeleton className={cn("h-4 w-full", className)} {...props} />
  ),

  /**
   * Heading skeleton
   */
  Heading: ({ className, ...props }: SkeletonProps) => (
    <Skeleton className={cn("h-8 w-3/4", className)} {...props} />
  ),

  /**
   * Avatar skeleton (circular)
   */
  Avatar: ({ className, ...props }: SkeletonProps) => (
    <Skeleton className={cn("size-12 rounded-full", className)} {...props} />
  ),

  /**
   * Button skeleton
   */
  Button: ({ className, ...props }: SkeletonProps) => (
    <Skeleton className={cn("h-10 w-24", className)} {...props} />
  ),

  /**
   * Card skeleton
   */
  Card: ({ className, ...props }: SkeletonProps) => (
    <Skeleton className={cn("h-32 w-full rounded-lg", className)} {...props} />
  ),

  /**
   * Image skeleton
   */
  Image: ({ className, ...props }: SkeletonProps) => (
    <Skeleton className={cn("aspect-video w-full", className)} {...props} />
  ),
};
