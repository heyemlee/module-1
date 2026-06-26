import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-studio-control text-[13px] font-semibold transition-[color,background-color,border-color,box-shadow,transform] outline-none focus-visible:ring-2 focus-visible:ring-studio-action/80 focus-visible:ring-offset-2 focus-visible:ring-offset-studio-void disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 disabled:transform-none aria-busy:cursor-wait motion-safe:hover:-translate-y-px motion-safe:active:translate-y-px motion-safe:active:scale-[0.98] [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "studio-cta hover:brightness-110",
        destructive:
          "bg-studio-danger text-studio-danger-ink shadow-sm shadow-black/20 hover:brightness-110",
        outline:
          "border border-white/80 bg-white/55 text-studio-ink backdrop-blur-sm shadow-sm shadow-black/5 hover:bg-white/75",
        secondary:
          "border border-white/80 bg-white/55 text-studio-ink backdrop-blur-sm shadow-sm shadow-black/5 hover:bg-white/75",
        inspector:
          "border border-studio-paper-line bg-studio-paper text-studio-paper-ink shadow-sm shadow-black/10 hover:bg-studio-paper-muted focus-visible:ring-offset-studio-paper",
        ghost: "text-studio-ink shadow-none hover:bg-white/45",
        link:
          "text-studio-action underline-offset-4 shadow-none hover:text-studio-action-strong hover:underline"
      },
      size: {
        default: "h-10 px-4",
        sm: "h-8 px-3",
        lg: "h-11 px-6",
        icon: "size-10"
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
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
