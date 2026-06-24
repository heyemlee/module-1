"use client";

import { Check, LockKeyhole } from "lucide-react";
import { cn } from "@/lib/utils";

export type CabinetConstructionOption<T extends string> = {
  value: T;
  label: string;
  image: string;
  description?: string;
};

export function CabinetConstructionStylePicker<T extends string>({
  value,
  options,
  onRequestSelect
}: {
  value: T;
  options: CabinetConstructionOption<T>[];
  onRequestSelect: (value: T) => void;
}) {
  return (
    <div className="flex flex-col items-stretch gap-3">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onRequestSelect(option.value)}
            className={cn(
              "group relative flex items-center gap-4 rounded-xl border bg-white px-5 py-3 text-left transition",
              selected
                ? "border-[var(--app-ink)] bg-black/[0.02]"
                : "border-[var(--app-border)] hover:border-slate-300 hover:shadow-sm"
            )}
          >
            <span className="overflow-hidden flex-1">
              <span className={cn("block truncate text-[14px] font-bold", selected ? "text-[var(--app-ink)]" : "text-[var(--app-ink)]")}>
                {option.label}
              </span>
              {option.description && (
                <span className="mt-0.5 block truncate text-[11px] text-[var(--app-muted)]">
                  {option.description}
                </span>
              )}
            </span>
            <div className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-full border", selected ? "border-[var(--app-ink)] bg-[var(--app-ink)] text-white" : "border-[#d2d2d7]")}>
              {selected && <Check className="h-3 w-3" />}
            </div>
          </button>
        );
      })}
    </div>
  );
}
