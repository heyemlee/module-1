"use client"

import * as React from "react"
import { useState, useEffect, useRef } from "react";
import { AnimatePresence, motion, type Variants } from "motion/react";

// Inline icons (was lucide-react: Mic, Send) — two glyphs don't justify a dep.
function MicIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" x2="12" y1="19" y2="22" />
    </svg>
  );
}

function SendIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </svg>
  );
}

// Cycling example prompts shown in the empty input (kitchen-intake, bilingual).
const PLACEHOLDERS = [
  '12 by 10 foot kitchen, U-shape, 36" sink',
  "厨房 12 尺 x 10 尺，L 型，要个岛台",
  "Gas range, French-door fridge, no island",
  "壁挂烤箱和内嵌微波叠在一起",
  "Galley kitchen, 30 inch induction range",
  "一字型，洗碗机 18 寸，不要岛台",
];

export type AIChatInputProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onMicClick?: () => void;
  micActive?: boolean;
  disabled?: boolean;
  placeholder?: string;
  controls?: React.ReactNode;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
};

// A single-row chat input: text + an optional controls slot (dictation language)
// + mic + send. Deliberately minimal — the template's Attach / Think / Deep
// Search controls were dead weight for the kitchen intake agent and crowded the
// panel, so they're gone.
const AIChatInput = ({
  value,
  onChange,
  onSubmit,
  onMicClick,
  micActive,
  disabled,
  placeholder,
  controls,
  onKeyDown
}: AIChatInputProps) => {
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [showPlaceholder, setShowPlaceholder] = useState(true);
  const [isActive, setIsActive] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputValue = value;

  // Cycle placeholder text when input is inactive and empty.
  useEffect(() => {
    if (isActive || inputValue) return;
    const interval = setInterval(() => {
      setShowPlaceholder(false);
      setTimeout(() => {
        setPlaceholderIndex((prev) => (prev + 1) % PLACEHOLDERS.length);
        setShowPlaceholder(true);
      }, 400);
    }, 3000);
    return () => clearInterval(interval);
  }, [isActive, inputValue]);

  // Deactivate (resume the cycling placeholder) when clicking outside, if empty.
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        if (!inputValue) setIsActive(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [inputValue]);

  const handleActivate = () => setIsActive(true);

  const placeholderContainerVariants: Variants = {
    initial: {},
    animate: { transition: { staggerChildren: 0.025 } },
    exit: { transition: { staggerChildren: 0.015, staggerDirection: -1 } },
  };

  const letterVariants: Variants = {
    initial: { opacity: 0, filter: "blur(12px)", y: 10 },
    animate: {
      opacity: 1,
      filter: "blur(0px)",
      y: 0,
      transition: {
        opacity: { duration: 0.25 },
        filter: { duration: 0.4 },
        y: { type: "spring", stiffness: 80, damping: 20 },
      },
    },
    exit: {
      opacity: 0,
      filter: "blur(12px)",
      y: -10,
      transition: {
        opacity: { duration: 0.2 },
        filter: { duration: 0.3 },
        y: { type: "spring", stiffness: 80, damping: 20 },
      },
    },
  };

  return (
    <div
      ref={wrapperRef}
      onClick={handleActivate}
      className="flex w-full items-center gap-1.5 rounded-[18px] border border-white/85 bg-white/70 py-1.5 pl-4 pr-1.5 text-studio-ink shadow-[0_1px_0_rgba(255,255,255,0.8)_inset,0_14px_30px_-18px_rgba(20,20,26,0.35)] backdrop-blur-md"
    >
      {/* Text input + animated cycling placeholder */}
      <div className="relative flex-1">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={disabled}
          placeholder={isActive && placeholder ? placeholder : ""}
          className="w-full border-0 bg-transparent py-2 text-[15px] font-normal outline-0 disabled:opacity-50"
          style={{ position: "relative", zIndex: 1 }}
          onFocus={handleActivate}
        />
        <div className="pointer-events-none absolute left-0 top-0 flex h-full w-full items-center">
          <AnimatePresence mode="wait">
            {showPlaceholder && !isActive && !inputValue && (
              <motion.span
                key={placeholderIndex}
                className="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 select-none text-[15px] text-gray-400"
                style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", zIndex: 0 }}
                variants={placeholderContainerVariants}
                initial="initial"
                animate="animate"
                exit="exit"
              >
                {PLACEHOLDERS[placeholderIndex].split("").map((char, i) => (
                  <motion.span key={i} variants={letterVariants} style={{ display: "inline-block" }}>
                    {char === " " ? " " : char}
                  </motion.span>
                ))}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>

      {controls}
      <button
        type="button"
        tabIndex={-1}
        onClick={onMicClick}
        disabled={disabled}
        title="Voice input"
        className={`shrink-0 rounded-full p-2.5 transition ${
          micActive
            ? "bg-red-100 text-red-600 hover:bg-red-200"
            : "text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
        }`}
      >
        <MicIcon size={18} />
      </button>
      <button
        type="button"
        tabIndex={-1}
        onClick={onSubmit}
        disabled={disabled}
        title="Send"
        className="studio-cta shrink-0 rounded-[12px] p-2.5 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <SendIcon size={16} />
      </button>
    </div>
  );
};

export { AIChatInput };
