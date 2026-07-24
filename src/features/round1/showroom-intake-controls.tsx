import type { ReactNode } from "react";
import { Input } from "@/components/ui/input";

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
