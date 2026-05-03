import * as React from "react";
import { ChevronsUpDown } from "lucide-react";

import { cn } from "@/lib/utils";

export interface StyledSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  wrapperClassName?: string;
}

export const StyledSelect = React.forwardRef<
  HTMLSelectElement,
  StyledSelectProps
>(({ className, wrapperClassName, children, ...props }, ref) => {
  return (
    <div className={cn("relative", wrapperClassName)}>
      <select
        ref={ref}
        className={cn(
          "h-8 w-full appearance-none rounded-md border bg-background px-2 pr-7 text-sm shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronsUpDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 opacity-60" />
    </div>
  );
});

StyledSelect.displayName = "StyledSelect";
