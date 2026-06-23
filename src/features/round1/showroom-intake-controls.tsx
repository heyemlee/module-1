import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";

export function Step({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div>
      {title && <h2 className="mb-5 text-[26px] font-bold leading-[32px] tracking-tight text-[var(--app-ink)]">{title}</h2>}
      {children}
    </div>
  );
}

export function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="app-panel-flat p-4">
      <h2 className="mb-3 text-sm font-bold text-[var(--app-ink)]">
        {title}
      </h2>
      {children}
    </section>
  );
}

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
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-[var(--app-muted)]">{label}</span>
      <Input
        type="number"
        value={value ?? ""}
        onChange={(event) =>
          onChange(event.target.value ? Number(event.target.value) : null)
        }
      />
    </label>
  );
}

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
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-[var(--app-muted)]">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="h-[42px] w-full justify-between">
            {value}
            <ChevronDown
              className="-me-1 ms-2 opacity-60"
              size={16}
              strokeWidth={2}
              aria-hidden="true"
            />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="min-w-[--radix-dropdown-menu-trigger-width]">
          {options.map((option) => (
            <DropdownMenuItem
              key={option}
              onSelect={() => onChange(option)}
            >
              {option}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </label>
  );
}

export function CheckboxField({
  label,
  checked,
  onChange,
  help
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  help?: string;
}) {
  return (
    <div>
      <label className="custom-checkbox">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span className="checkmark" />
        <span>{label}</span>
      </label>
      {help ? (
        <p className="mt-1 pl-[34px] text-xs leading-5 text-[var(--app-muted)]">
          {help}
        </p>
      ) : null}
    </div>
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
    red: "bg-[var(--app-red-soft)] text-[var(--app-red)]",
    amber: "bg-[var(--app-amber-soft)] text-[var(--app-amber)]",
    green: "bg-[var(--app-green-soft)] text-[var(--app-green)]"
  };
  return <span className={`rounded-full px-2.5 py-1 ${classes[tone]}`}>{label}</span>;
}

export function parseNullableSize(value: string) {
  return value === "UNKNOWN" ? null : Number(value);
}
