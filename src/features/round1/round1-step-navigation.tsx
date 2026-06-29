"use client";

import { CheckIcon, LockClosedIcon } from "@radix-ui/react-icons";
import { cn } from "@/lib/utils";

type StepState = "completed" | "current" | "available" | "locked";
type StepNavigationVariant = "expanded" | "compact" | "strip" | "top";

function stepState(
  index: number,
  currentStep: number,
  maxAccessibleStep: number
): StepState {
  if (index < currentStep) return "completed";
  if (index === currentStep) return "current";
  if (index <= maxAccessibleStep) return "available";
  return "locked";
}

function stepAriaLabel(label: string, state: StepState) {
  if (state === "completed") return `${label}, completed`;
  if (state === "current") return `${label}, current step`;
  if (state === "locked") return `${label}, locked`;
  return `${label}, available`;
}

export function Round1StepNavigation({
  steps,
  meta,
  currentStep,
  maxAccessibleStep,
  variant,
  onStepChange
}: {
  steps: readonly string[];
  meta?: readonly string[];
  currentStep: number;
  maxAccessibleStep: number;
  variant: StepNavigationVariant;
  onStepChange: (step: number) => void;
}) {
  // Horizontal step strip that sits under the project bar (design chrome).
  if (variant === "top") {
    return (
      <nav aria-label="Round 1 steps">
        <ol className="flex">
          {steps.map((label, index) => {
            const state = stepState(index, currentStep, maxAccessibleStep);
            const disabled = state === "locked";
            return (
              <li key={label} className="flex-1">
                <button
                  type="button"
                  disabled={disabled}
                  aria-current={state === "current" ? "step" : undefined}
                  aria-label={stepAriaLabel(label, state)}
                  data-step-state={state}
                  onClick={() => {
                    if (!disabled) onStepChange(index);
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 border-r border-[rgba(20,20,26,0.06)] px-[18px] py-[14px] text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-studio-action disabled:cursor-not-allowed",
                    "border-b-2",
                    state === "current"
                      ? "border-b-[#1a1a1c] bg-white/[0.72]"
                      : "border-b-transparent hover:bg-white/40",
                    disabled && "opacity-55 hover:bg-transparent"
                  )}
                >
                  <span
                    className={cn(
                      "flex size-[26px] shrink-0 items-center justify-center rounded-full font-mono text-[11px]",
                      state === "current" && "bg-[#1a1a1c] text-white",
                      state === "completed" &&
                        "bg-[rgba(20,20,26,0.12)] text-[#16161a]",
                      (state === "available" || state === "locked") &&
                        "bg-white/50 text-[#a4a49e]"
                    )}
                  >
                    {state === "completed"
                      ? "✓"
                      : String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="flex min-w-0 flex-col leading-tight">
                    <span className="truncate text-[13.5px] font-semibold text-[#16161a]">
                      {label}
                    </span>
                    {meta?.[index] && (
                      <span className="truncate font-mono text-[9.5px] tracking-[0.08em] text-[#a4a49e]">
                        {meta[index]}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>
    );
  }

  return (
    <nav aria-label="Round 1 steps">
      <ol
        className={cn(
          variant === "expanded" && "grid gap-2",
          variant === "compact" && "grid justify-items-center gap-3",
          variant === "strip" &&
            "grid grid-flow-col auto-cols-fr gap-1 overflow-x-auto"
        )}
      >
        {steps.map((label, index) => {
          const state = stepState(index, currentStep, maxAccessibleStep);
          const disabled = state === "locked";
          return (
            <li key={label}>
              <button
                type="button"
                disabled={disabled}
                aria-current={state === "current" ? "step" : undefined}
                aria-label={stepAriaLabel(label, state)}
                data-step-state={state}
                onClick={() => {
                  if (!disabled) onStepChange(index);
                }}
                className={cn(
                  "group flex min-h-10 w-full items-center rounded-studio-control text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-studio-action disabled:cursor-not-allowed",
                  variant === "expanded" && "gap-3 px-3",
                  variant === "compact" && "size-10 justify-center px-0",
                  variant === "strip" &&
                    "min-w-[88px] justify-center px-2 text-center",
                  state === "current" &&
                    "bg-studio-action text-studio-action-ink",
                  state === "completed" &&
                    "bg-studio-surface text-studio-action",
                  state === "available" &&
                    "text-studio-muted hover:bg-white/[0.05] hover:text-studio-ink",
                  state === "locked" && "text-studio-quiet opacity-55"
                )}
              >
                <span
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold",
                    state === "current" &&
                      "border-studio-action-ink/20 bg-studio-action-ink/10",
                    state === "completed" &&
                      "border-studio-action/30 bg-studio-action/10",
                    (state === "available" || state === "locked") &&
                      "border-current/25"
                  )}
                >
                  {state === "completed" ? (
                    <CheckIcon className="size-3" aria-hidden />
                  ) : state === "locked" ? (
                    <LockClosedIcon className="size-2.5" aria-hidden />
                  ) : (
                    index + 1
                  )}
                </span>
                {variant !== "compact" && (
                  <span className="truncate text-[11px] font-semibold">
                    {label}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
