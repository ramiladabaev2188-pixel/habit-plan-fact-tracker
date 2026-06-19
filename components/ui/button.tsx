import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-[0_10px_24px_-16px_hsl(var(--primary))] hover:bg-primary/90 hover:shadow-[0_14px_30px_-18px_hsl(var(--primary))]",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/75",
        destructive:
          "bg-destructive text-destructive-foreground shadow-[0_10px_24px_-16px_hsl(var(--destructive))] hover:bg-destructive/90",
        outline:
          "border border-input bg-background/80 hover:border-primary/40 hover:bg-primary/5 hover:text-foreground",
        ghost: "hover:bg-muted hover:text-foreground",
        success: "bg-success text-success-foreground shadow-[0_10px_24px_-16px_hsl(var(--success))] hover:bg-success/90",
        warning: "bg-warning text-warning-foreground hover:bg-warning/90",
        over: "bg-over text-over-foreground hover:bg-over/90"
      },
      size: {
        default: "px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-11 rounded-md px-6",
        icon: "h-10 w-10"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
