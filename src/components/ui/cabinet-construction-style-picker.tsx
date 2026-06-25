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
              "group relative flex items-center gap-4 rounded-studio-control border bg-studio-paper px-5 py-3 text-left text-studio-paper-ink transition",
              selected
                ? "border-studio-action-strong bg-studio-paper-muted"
                : "border-studio-paper-line hover:border-studio-action-strong/60"
            )}
          >
            <span className="overflow-hidden flex-1">
              <span className="block truncate text-[14px] font-bold text-studio-paper-ink">
                {option.label}
              </span>
              {option.description && (
                <span className="mt-0.5 block truncate text-[11px] text-studio-paper-muted-ink">
                  {option.description}
                </span>
              )}
            </span>
            <div
              className={cn(
                "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                selected
                  ? "border-studio-action bg-studio-action text-studio-action-ink"
                  : "border-studio-paper-line"
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
