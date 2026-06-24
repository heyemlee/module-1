"use client";

import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { CheckIcon, MinusIcon } from "@radix-ui/react-icons";
import * as React from "react";

import { cn } from "@/lib/utils";

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "group peer size-5 shrink-0 rounded-studio-small border border-studio-line-strong bg-studio-surface text-studio-action-ink shadow-sm shadow-black/10 outline-none transition-[background-color,border-color,box-shadow] focus-visible:ring-2 focus-visible:ring-studio-action/80 focus-visible:ring-offset-2 focus-visible:ring-offset-studio-void disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-studio-action data-[state=indeterminate]:border-studio-action data-[state=checked]:bg-studio-action data-[state=indeterminate]:bg-studio-action",
      className
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator className="flex items-center justify-center text-current">
      <CheckIcon className="size-4 group-data-[state=indeterminate]:hidden" />
      <MinusIcon className="hidden size-4 group-data-[state=indeterminate]:block" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
