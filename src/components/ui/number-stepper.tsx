import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "./cn";

interface NumberStepperProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
}

// Ghost ▲▼ stepper with a floating mono label and tabular value — ported from the mockup.
export function NumberStepper({
  label,
  value,
  onChange,
  min = 0,
  max = 999,
  step = 1,
  unit = "in"
}: NumberStepperProps) {
  const clamp = (next: number) => Math.min(max, Math.max(min, next));

  const updateFromInput = (raw: string) => {
    if (raw === "") {
      onChange(min);
      return;
    }
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isNaN(parsed)) onChange(clamp(parsed));
  };

  return (
    <div className="group relative flex-1">
      <label className="absolute -top-2.5 left-3 z-10 bg-surface px-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-subtle-foreground">
        {label}
      </label>

      <div className="relative flex h-11 overflow-hidden rounded-lg border border-border bg-input transition-all duration-200 group-focus-within:border-accent group-focus-within:ring-1 group-focus-within:ring-accent/40">
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => updateFromInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowUp") {
              e.preventDefault();
              onChange(clamp(value + (e.shiftKey ? step * 10 : step)));
            } else if (e.key === "ArrowDown") {
              e.preventDefault();
              onChange(clamp(value - (e.shiftKey ? step * 10 : step)));
            }
          }}
          className="h-full min-w-0 flex-1 bg-transparent px-3 pr-16 font-mono text-base font-medium leading-none text-foreground outline-none tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          aria-label={label}
        />

        <span className="pointer-events-none absolute right-8 top-1/2 -translate-y-1/2 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-subtle-foreground">
          {unit}
        </span>

        <div className="absolute bottom-0 right-0 top-0 flex w-7 flex-col">
          <StepButton onClick={() => onChange(clamp(value + step))} disabled={value >= max} label={`Increase ${label}`}>
            <ChevronUp size={10} strokeWidth={2.5} />
          </StepButton>
          <div className="mx-1 h-px bg-border" />
          <StepButton onClick={() => onChange(clamp(value - step))} disabled={value <= min} label={`Decrease ${label}`}>
            <ChevronDown size={10} strokeWidth={2.5} />
          </StepButton>
        </div>
      </div>
    </div>
  );
}

function StepButton({
  onClick,
  disabled,
  label,
  children
}: {
  onClick: () => void;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        "flex flex-1 items-center justify-center text-subtle-foreground transition-all duration-150",
        "hover:bg-surface-2 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-20"
      )}
    >
      {children}
    </button>
  );
}
