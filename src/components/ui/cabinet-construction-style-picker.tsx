"use client";

import { Check, LockKeyhole } from "lucide-react";
import { cn } from "@/lib/utils";

export type CabinetConstructionOption<T extends string> = {
  value: T;
  label: string;
  image: string;
  description: string;
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
              "group relative flex items-center gap-3 rounded-xl border bg-white p-3 text-left transition",
              selected
                ? "border-[var(--app-blue)] ring-1 ring-[var(--app-blue)] bg-blue-50/30"
                : "border-[var(--app-border)] hover:border-slate-300 hover:shadow-sm"
            )}
          >
            <span className="flex h-12 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md bg-[var(--app-surface-muted)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={option.image}
                alt={option.label}
                className="h-full w-full object-cover transition duration-300 group-hover:scale-110"
                loading="lazy"
                decoding="async"
              />
            </span>
            <span className="flex-1 overflow-hidden">
              <span className="flex items-center justify-between gap-2">
                <span className={cn("truncate text-sm font-bold", selected ? "text-[var(--app-blue)]" : "text-[var(--app-ink)]")}>
                  {option.label}
                </span>
                {selected ? (
                  <Check className="h-4 w-4 shrink-0 text-[var(--app-blue)]" />
                ) : null}
              </span>
              <span className="mt-0.5 block truncate text-xs text-[var(--app-muted)]">
                {option.description}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
