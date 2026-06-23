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
    <div className="grid gap-4 sm:grid-cols-2">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onRequestSelect(option.value)}
            className={cn(
              "group relative overflow-hidden rounded-lg border bg-white text-left transition",
              selected
                ? "border-[#333] shadow-[0_0_0_3px_rgba(0,0,0,0.12)]"
                : "border-[var(--app-border)] hover:border-[#333]"
            )}
          >
            <span className="block aspect-[4/3] overflow-hidden bg-[var(--app-surface-muted)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={option.image}
                alt={option.label}
                className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                loading="lazy"
                decoding="async"
              />
            </span>
            <span className="block p-4">
              <span className="flex items-center justify-between gap-3">
                <span className="text-base font-semibold text-[var(--app-ink)]">
                  {option.label}
                </span>
                {selected ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#333] px-2.5 py-1 text-xs font-semibold text-white">
                    <LockKeyhole className="h-3.5 w-3.5" />
                    Locked
                  </span>
                ) : null}
              </span>
              <span className="mt-2 block text-sm leading-6 text-[var(--app-muted)]">
                {option.description}
              </span>
            </span>
            {selected ? (
              <span className="absolute left-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-[#333] text-white shadow-lg">
                <Check className="h-5 w-5" />
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
