import type { ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

export function Step({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="pt-4">
      {title && <h2 className="mb-5 text-[26px] font-bold leading-[32px] tracking-tight text-studio-paper-ink">{title}</h2>}
      {children}
    </div>
  );
}

export function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-studio-control border border-studio-paper-line bg-studio-paper p-4 text-studio-paper-ink">
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
      <span className="studio-eyebrow mb-1.5 block">{label}</span>
      <Input
        type="number"
        value={value ?? ""}
        onChange={(event) =>
          onChange(event.target.value ? Number(event.target.value) : null)
        }
        className="h-auto rounded-[11px] px-[13px] py-3 font-mono text-[15px]"
      />
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
        className="mt-0.5"
      />
      <span>
        <span className="block text-[13px] font-medium text-studio-ink">
          {label}
        </span>
        {help && (
          <span className="mt-1 block text-[11px] leading-4 text-studio-muted">
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
    red: "bg-studio-danger/15 text-studio-danger-ink",
    amber: "bg-studio-warning/25 text-studio-warning-ink",
    green: "bg-studio-action/30 text-studio-action-ink"
  };
  return <span className={`rounded-full px-2.5 py-1 ${classes[tone]}`}>{label}</span>;
}

export function parseNullableSize(value: string) {
  return value === "UNKNOWN" ? null : Number(value);
}
