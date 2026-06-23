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
    <div className="grid gap-3 sm:grid-cols-2">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onRequestSelect(option.value)}
            className={cn(
              "group relative flex items-center justify-between rounded-xl border bg-white p-4 text-left transition",
              selected
                ? "border-[var(--app-ink)] bg-black/[0.02]"
                : "border-[var(--app-border)] hover:border-slate-300 hover:shadow-sm"
            )}
          >
            <span className="flex-1 overflow-hidden pr-4">
              <span className={cn("block truncate text-sm font-bold", selected ? "text-[var(--app-ink)]" : "text-[var(--app-ink)]")}>
                {option.label}
              </span>
              {option.description && (
                <span className="mt-1 block truncate text-xs text-[var(--app-muted)]">
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
