"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "./cn";

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  label?: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

// Custom dropdown (click-outside + keyboard) — ported from the mockup, tokenized.
export function Select({
  label,
  value,
  options,
  onChange,
  placeholder = "—",
  className = ""
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const selected = options.find((o) => o.value === value);

  return (
    <div className={cn("group relative", className)} ref={ref}>
      {label && (
        <span className="pointer-events-none absolute -top-2.5 left-3 z-20 bg-surface px-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-subtle-foreground">
          {label}
        </span>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((v) => !v);
          }
        }}
        className={cn(
          "relative flex h-11 w-full items-center rounded-lg border bg-input px-3 pr-10 text-left text-sm text-foreground outline-none transition-all duration-200",
          open ? "border-accent ring-1 ring-accent/40" : "border-border hover:border-border-strong"
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="truncate font-mono font-medium leading-none">{selected?.label ?? placeholder}</span>
        <ChevronDown
          size={16}
          strokeWidth={2}
          className={cn(
            "pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-subtle-foreground transition-transform duration-200",
            open && "rotate-180 text-accent"
          )}
        />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-1.5 max-h-64 overflow-auto rounded-lg border border-border bg-surface shadow-lg"
        >
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between px-3 py-2.5 text-left font-mono text-[13px] transition-colors",
                  isSelected
                    ? "bg-primary/10 text-primary"
                    : "text-foreground hover:bg-surface-2"
                )}
              >
                <span>{opt.label}</span>
                {isSelected && <Check size={13} strokeWidth={2.5} className="ml-2 shrink-0 text-accent" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
