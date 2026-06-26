"use client";

import { CheckIcon } from "@radix-ui/react-icons";
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
              "group relative flex items-center gap-4 rounded-[12px] border px-5 py-3 text-left text-studio-ink transition",
              selected
                ? "border-studio-ink bg-white/80 shadow-[inset_0_1px_0_#fff,0_8px_18px_-10px_rgba(20,20,26,0.32)]"
                : "border-white/85 bg-white/60 hover:border-studio-ink/40"
            )}
          >
            <span className="overflow-hidden flex-1">
              <span className="block truncate text-[14px] font-bold text-studio-ink">
                {option.label}
              </span>
              {option.description && (
                <span className="mt-0.5 block truncate text-[11px] text-studio-muted">
                  {option.description}
                </span>
              )}
            </span>
            <div
              className={cn(
                "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                selected
                  ? "border-studio-ink bg-studio-ink text-white"
                  : "border-studio-ink/25"
              )}
            >
              {selected && <CheckIcon className="h-3 w-3" />}
            </div>
          </button>
        );
      })}
    </div>
  );
}
