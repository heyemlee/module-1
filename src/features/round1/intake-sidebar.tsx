"use client";

import { Check } from "lucide-react";
import { Logo } from "@/components/page-shell";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { cn } from "@/components/ui/cn";

// Vertical stage stepper for the intake shell. Driven by the app's step state;
// gated by maxAccessibleStep (future steps are disabled).
export function IntakeSidebar({
  steps,
  step,
  maxAccessibleStep,
  onStepClick
}: {
  steps: readonly string[];
  step: number;
  maxAccessibleStep: number;
  onStepClick: (index: number) => void;
}) {
  return (
    <div className="flex h-full flex-col border-r border-border bg-background p-5">
      <div className="mb-8 flex items-center justify-between">
        <Logo />
        <ThemeToggle />
      </div>

      <p className="mb-2 px-1 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-subtle-foreground">
        Stages
      </p>
      <nav className="space-y-0.5">
        {steps.map((label, index) => {
          const isActive = index === step;
          const isCompleted = index < step;
          const isLocked = index > maxAccessibleStep;
          return (
            <button
              key={label}
              type="button"
              onClick={() => onStepClick(index)}
              disabled={isLocked}
              className={cn(
                "relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all",
                isActive ? "bg-primary/10" : "hover:bg-surface-2",
                isLocked && "cursor-not-allowed opacity-50 hover:bg-transparent"
              )}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary" />
              )}
              <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                {isCompleted ? (
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary">
                    <Check size={10} strokeWidth={3} className="text-primary-foreground" />
                  </span>
                ) : isActive ? (
                  <span className="flex h-4 w-4 items-center justify-center rounded-full border-[1.5px] border-primary">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  </span>
                ) : (
                  <span className="flex h-4 w-4 items-center justify-center rounded-full border border-border-strong">
                    <span className="font-mono text-[9px] text-subtle-foreground">{index + 1}</span>
                  </span>
                )}
              </span>
              <span
                className={cn(
                  "text-[13px]",
                  isActive
                    ? "font-medium text-primary"
                    : isCompleted
                      ? "font-medium text-foreground"
                      : "text-muted-foreground"
                )}
              >
                {label}
              </span>
            </button>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-1 px-1 pt-8">
        <span className="text-xs font-medium text-foreground">kabi workspace</span>
        <div className="mt-1 flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-success" />
          <span className="text-[11px] text-muted-foreground">Round 1 intake</span>
        </div>
      </div>
    </div>
  );
}
