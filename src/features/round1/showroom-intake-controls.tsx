import type { ReactNode } from "react";
import { ChevronDownIcon } from "@radix-ui/react-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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
      <h2 className="mb-3 text-sm font-bold text-studio-paper-ink">
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
      <span className="mb-1 block text-[13px] font-medium text-studio-paper-ink">{label}</span>
      <Input
        type="number"
        data-surface="inspector"
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
      <span className="mb-1 block text-[13px] font-medium text-studio-paper-ink">{label}</span>
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
          <Button variant="inspector" className="h-[42px] w-full justify-between">
            {value}
            <ChevronDownIcon
              className="-me-1 ms-2 opacity-60"
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
    <label className="flex items-start gap-3">
      <Checkbox
        checked={checked}
        onCheckedChange={(value) => onChange(value === true)}
        className="mt-0.5 border-[#9aa79f] bg-white data-[state=checked]:border-studio-action data-[state=checked]:bg-studio-action"
      />
      <span>
        <span className="block text-[13px] font-medium text-studio-paper-ink">
          {label}
        </span>
        {help && (
          <span className="mt-1 block text-[11px] leading-4 text-[#607067]">
            {help}
          </span>
        )}
      </span>
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
    red: "bg-[var(--app-red-soft)] text-[var(--app-red)]",
    amber: "bg-[var(--app-amber-soft)] text-[var(--app-amber)]",
    green: "bg-[var(--app-green-soft)] text-[var(--app-green)]"
  };
  return <span className={`rounded-full px-2.5 py-1 ${classes[tone]}`}>{label}</span>;
}

export function parseNullableSize(value: string) {
  return value === "UNKNOWN" ? null : Number(value);
}
