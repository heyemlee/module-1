import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

export function Step({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h2 className="text-xl font-semibold tracking-tight text-foreground">{title}</h2>
      <p className="mb-6 mt-2 text-sm leading-6 text-muted-foreground">
        Unknown or rough answers are allowed. They stay visible as Confirmation Required.
      </p>
      {children}
    </div>
  );
}

export function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-surface p-4 shadow-sm">
      <h2 className="mb-3 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}

// Floating mono-label native number input. Native <label><span/><input/></label>
// structure is preserved so the intake SSR tests can locate fields by label.
export function NumberField({
  label,
  value,
  onChange
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  return (
    <label className="group relative block">
      <span className="absolute -top-2 left-3 z-10 bg-surface px-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-subtle-foreground">
        {label}
      </span>
      <input
        type="number"
        value={value ?? ""}
        onChange={(event) =>
          onChange(event.target.value ? Number(event.target.value) : null)
        }
        className="h-11 w-full rounded-lg border border-border bg-input px-3 font-mono text-sm text-foreground outline-none transition-all hover:border-border-strong focus:border-accent focus:ring-1 focus:ring-accent/40"
      />
    </label>
  );
}

// Floating mono-label native select with a custom chevron. The native <select>
// is kept (appearance-none) so it stays test-locatable and fully accessible.
export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
}) {
  return (
    <label className="group relative block">
      <span className="absolute -top-2 left-3 z-10 bg-surface px-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-subtle-foreground">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className="h-11 w-full appearance-none rounded-lg border border-border bg-input px-3 pr-9 font-mono text-sm text-foreground outline-none transition-all hover:border-border-strong focus:border-accent focus:ring-1 focus:ring-accent/40"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <ChevronDown
        size={16}
        strokeWidth={2}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-subtle-foreground"
      />
    </label>
  );
}

export function StatusPill({
  label,
  tone
}: {
  label: string;
  tone: "red" | "amber" | "green";
}) {
  const classes = {
    red: "bg-danger-surface text-danger-foreground",
    amber: "bg-warning-surface text-warning-foreground",
    green: "bg-success-surface text-success-foreground"
  };
  return (
    <span className={`rounded-md px-2.5 py-1 text-xs font-medium ${classes[tone]}`}>{label}</span>
  );
}

export function parseNullableSize(value: string) {
  return value === "UNKNOWN" ? null : Number(value);
}
