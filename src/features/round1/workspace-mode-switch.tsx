"use client";

import { ColumnsIcon, ViewGridIcon } from "@radix-ui/react-icons";
import { cn } from "@/lib/utils";
import type { WorkspaceMode } from "./workspace-mode";

const options: Array<{
  mode: WorkspaceMode;
  label: string;
  icon: typeof ColumnsIcon;
}> = [
  { mode: "guided", label: "Guided", icon: ColumnsIcon },
  { mode: "canvas", label: "Canvas focus", icon: ViewGridIcon }
];

export function WorkspaceModeSwitch({
  mode,
  onModeChange
}: {
  mode: WorkspaceMode;
  onModeChange: (mode: WorkspaceMode) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Workspace layout"
      className="inline-flex rounded-studio-control border border-studio-line bg-studio-void p-1"
    >
      {options.map((option) => {
        const selected = mode === option.mode;
        const Icon = option.icon;
        return (
          <button
            key={option.mode}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onModeChange(option.mode)}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-studio-small px-3 text-[11px] font-semibold outline-none transition-[background-color,color,transform] duration-200 focus-visible:ring-2 focus-visible:ring-studio-action motion-safe:active:scale-[0.98]",
              selected
                ? "bg-studio-action text-studio-action-ink"
                : "text-studio-quiet hover:bg-white/[0.05] hover:text-studio-ink"
            )}
          >
            <Icon className="size-3.5" aria-hidden />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
