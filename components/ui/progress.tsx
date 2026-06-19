import * as React from "react";
import { cn } from "@/lib/utils";

type ProgressProps = React.HTMLAttributes<HTMLDivElement> & {
  value: number;
  indicatorClassName?: string;
};

export function Progress({
  value,
  className,
  indicatorClassName,
  ...props
}: ProgressProps) {
  const safeValue = Math.max(0, Math.min(100, value));

  return (
    <div
      className={cn("relative h-2.5 w-full overflow-hidden rounded-full bg-muted shadow-inner", className)}
      {...props}
    >
      <div
        className={cn("h-full bg-primary transition-all duration-500", indicatorClassName)}
        style={{ width: `${safeValue}%` }}
      />
    </div>
  );
}
