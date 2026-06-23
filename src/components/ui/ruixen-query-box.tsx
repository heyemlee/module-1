"use client";

import { Mic, Send, Square } from "lucide-react";
import type { KeyboardEvent, ReactNode } from "react";
import { cn } from "@/lib/utils";

export default function RuixenQueryBox({
  value,
  placeholder,
  disabled,
  micSupported,
  micActive,
  onValueChange,
  onKeyDown,
  onMicClick,
  onSend,
  controls
}: {
  value: string;
  placeholder: string;
  disabled?: boolean;
  micSupported?: boolean;
  micActive?: boolean;
  onValueChange: (value: string) => void;
  onKeyDown?: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  onMicClick?: () => void;
  onSend?: () => void;
  controls?: ReactNode;
}) {
  return (
    <div className="relative flex flex-col rounded-2xl border border-[var(--app-border)] bg-white p-2 shadow-sm focus-within:border-[var(--app-blue)] focus-within:ring-1 focus-within:ring-[var(--app-blue)]">
      <textarea
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        rows={2}
        className="w-full resize-none bg-transparent px-3 py-2 text-sm text-[var(--app-ink)] placeholder-[var(--app-muted)] outline-none disabled:opacity-50"
      />
      
      <div className="mt-2 flex items-center justify-between px-2 pb-1">
        <div className="flex items-center gap-2">
          {controls}
        </div>
        <div className="flex items-center gap-2">
          {micSupported && (
            <button
              type="button"
              onClick={onMicClick}
              disabled={disabled && !micActive}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full transition-colors",
                micActive
                  ? "bg-red-100 text-red-600 hover:bg-red-200"
                  : "bg-slate-100 text-slate-500 hover:bg-slate-200 disabled:opacity-50"
              )}
            >
              {micActive ? <Square className="h-4 w-4 fill-current" /> : <Mic className="h-4 w-4" />}
            </button>
          )}
          <button
            type="button"
            onClick={onSend}
            disabled={disabled || !value.trim()}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--app-blue)] text-white transition-colors hover:bg-blue-600 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
