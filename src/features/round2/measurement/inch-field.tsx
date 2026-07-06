"use client";

import { cn } from "@/lib/utils";

// Measurements are stored as integer sixteenths of an inch. The old control was
// a native `type="number"` with `step={1/16}`, whose spinner nudged a sixteenth
// per click. This field keeps a plain whole-inch input and picks the sixteenths
// from a fraction dropdown.

const SIXTEENTHS_PER_INCH = 16;

// index === numerator (0..15). Index 0 is the whole-inch (no fraction) case.
const FRACTIONS = [
  "—",
  "1/16",
  "1/8",
  "3/16",
  "1/4",
  "5/16",
  "3/8",
  "7/16",
  "1/2",
  "9/16",
  "5/8",
  "11/16",
  "3/4",
  "13/16",
  "7/8",
  "15/16"
] as const;

export type InchFieldProps = {
  value: number | null;
  onChange: (value: number | null) => void;
  onFocus?: () => void;
  inputRef?: (element: HTMLInputElement | null) => void;
  ariaLabel: string;
  disabled?: boolean;
};

export function InchField({
  value,
  onChange,
  onFocus,
  inputRef,
  ariaLabel,
  disabled = false
}: InchFieldProps) {
  const hasValue = value != null;
  const sixteenths = value ?? 0;
  const whole = Math.floor(sixteenths / SIXTEENTHS_PER_INCH);
  const numerator = sixteenths % SIXTEENTHS_PER_INCH;

  const emit = (nextWhole: number, nextNumerator: number) => {
    const next = Math.max(0, nextWhole) * SIXTEENTHS_PER_INCH + nextNumerator;
    // Collapse an all-zero value back to "unmeasured" so the field can be cleared.
    onChange(next === 0 ? null : next);
  };

  const setWholeFromText = (text: string) => {
    if (text.trim() === "") {
      // Empty whole field keeps any chosen fraction; otherwise clears the field.
      onChange(numerator === 0 ? null : numerator);
      return;
    }
    const parsed = Number.parseInt(text, 10);
    if (Number.isNaN(parsed)) return;
    emit(parsed, numerator);
  };

  return (
    <span className="mt-2 flex items-stretch gap-2">
      <span className="relative block flex-1">
        <input
          ref={inputRef}
          aria-label={ariaLabel}
          type="text"
          inputMode="numeric"
          disabled={disabled}
          value={hasValue ? String(whole) : ""}
          placeholder="0"
          onFocus={onFocus}
          onChange={(event) => setWholeFromText(event.target.value)}
          className="h-11 w-full rounded-studio-control border border-studio-line-strong bg-white px-3 pr-9 font-mono text-[13px] outline-none transition-colors focus:border-studio-ink focus:ring-2 focus:ring-studio-ink/10 disabled:cursor-not-allowed disabled:bg-black/[0.035] disabled:text-studio-muted"
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[9px] text-studio-quiet">
          IN
        </span>
      </span>

      <span className="relative shrink-0">
        <select
          aria-label={`${ariaLabel} fraction`}
          disabled={disabled}
          value={numerator}
          onChange={(event) => emit(whole, Number(event.target.value))}
          className="h-11 w-[92px] appearance-none rounded-studio-control border border-studio-line-strong bg-white pl-3 pr-8 font-mono text-[13px] outline-none transition-colors focus:border-studio-ink focus:ring-2 focus:ring-studio-ink/10 disabled:cursor-not-allowed disabled:bg-black/[0.035] disabled:text-studio-muted"
        >
          {FRACTIONS.map((label, index) => (
            <option key={label} value={index}>
              {label}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-studio-quiet">
          <svg width="9" height="6" viewBox="0 0 9 6" fill="none" aria-hidden="true">
            <path
              d="M1 1l3.5 3.5L8 1"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </span>
    </span>
  );
}
