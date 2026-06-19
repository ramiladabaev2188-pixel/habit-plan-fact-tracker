import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold transition-[transform,box-shadow,background-color,border-color,color] duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 enabled:hover:-translate-y-px enabled:active:translate-y-0 enabled:active:scale-[0.98]",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-[0_12px_24px_-18px_hsl(var(--primary))] hover:bg-primary/90 hover:shadow-[0_16px_28px_-18px_hsl(var(--primary))]",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "bg-destructive text-destructive-foreground shadow-[0_10px_24px_-16px_hsl(var(--destructive))] hover:bg-destructive/90",
        outline:
          "border border-input bg-background hover:border-primary/40 hover:bg-primary/[0.045] hover:text-foreground",
        ghost: "hover:bg-primary/[0.06] hover:text-foreground",
        success: "bg-success text-success-foreground shadow-[0_10px_24px_-16px_hsl(var(--success))] hover:bg-success/90",
        warning: "bg-warning text-warning-foreground hover:bg-warning/90",
        over: "bg-over text-over-foreground hover:bg-over/90"
      },
      size: {
        default: "px-4 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-11 px-5",
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
