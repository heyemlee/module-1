import { forwardRef, useId } from "react";
import { cn } from "./cn";

// Floating mono-label input, matching the mockup's control language.
export interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string;
}

export const Field = forwardRef<HTMLInputElement, FieldProps>(
  ({ label, hint, error, className, id, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    return (
      <div className="group relative">
        <label
          htmlFor={inputId}
          className="absolute -top-2 left-3 z-10 bg-surface px-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-subtle-foreground"
        >
          {label}
        </label>
        <input
          ref={ref}
          id={inputId}
          className={cn(
            "h-11 w-full rounded-lg border bg-input px-3 text-sm text-foreground outline-none transition-all duration-200 placeholder:text-subtle-foreground",
            "focus:border-accent focus:ring-1 focus:ring-accent/40",
            error ? "border-danger" : "border-border hover:border-border-strong",
            className
          )}
          aria-invalid={error ? true : undefined}
          {...props}
        />
        {hint && !error && <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>}
        {error && <p className="mt-1.5 text-xs text-danger-foreground">{error}</p>}
      </div>
    );
  }
);

Field.displayName = "Field";

// Floating-label wrapper for arbitrary controls (textarea, native select, etc.).
export function FieldShell({
  label,
  className,
  children
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("group relative", className)}>
      <span className="absolute -top-2 left-3 z-10 bg-surface px-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-subtle-foreground">
        {label}
      </span>
      {children}
    </div>
  );
}
