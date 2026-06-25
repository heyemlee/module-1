"use client"

import * as React from "react"
import { useState, useEffect, useRef } from "react";
import { Mic } from "lucide-react";
import { LightningBoltIcon, GlobeIcon, Link2Icon, PaperPlaneIcon } from "@radix-ui/react-icons";
import { AnimatePresence, motion, type Variants } from "motion/react";

const PLACEHOLDERS = [
  "Generate website with HextaUI",
  "Create a new project with Next.js",
  "What is the meaning of life?",
  "What is the best way to learn React?",
  "How to cook a delicious meal?",
  "Summarize this article",
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
  const [thinkActive, setThinkActive] = useState(false);
  const [deepSearchActive, setDeepSearchActive] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputValue = value;

  // Cycle placeholder text when input is inactive
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

  // Close input when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        if (!inputValue) setIsActive(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [inputValue]);

  const handleActivate = () => setIsActive(true);

  const containerVariants: Variants = {
    collapsed: {
      height: 68,
      boxShadow: "0 2px 8px 0 rgba(0,0,0,0.08)",
      transition: { type: "spring", stiffness: 120, damping: 18 },
    },
    expanded: {
      height: 128,
      boxShadow: "0 8px 32px 0 rgba(0,0,0,0.16)",
      transition: { type: "spring", stiffness: 120, damping: 18 },
    },
  };

  const placeholderContainerVariants: Variants = {
    initial: {},
    animate: { transition: { staggerChildren: 0.025 } },
    exit: { transition: { staggerChildren: 0.015, staggerDirection: -1 } },
  };

  const letterVariants: Variants = {
    initial: {
      opacity: 0,
      filter: "blur(12px)",
      y: 10,
    },
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
    <div className="relative z-10 flex w-full items-center justify-center text-studio-paper-ink">
      <motion.div
        ref={wrapperRef}
        className="w-full max-w-3xl overflow-hidden rounded-[24px] border border-studio-paper-line bg-studio-paper"
        variants={containerVariants}
        animate={isActive || inputValue ? "expanded" : "collapsed"}
        initial="collapsed"
        onClick={handleActivate}
      >
        <div className="flex flex-col items-stretch w-full h-full">
          {/* Input Row */}
          <div className="flex w-full max-w-3xl items-center gap-2 p-3">
            <button
              className="rounded-full p-3 transition hover:bg-studio-paper-muted"
              title="Attach file"
              type="button"
              tabIndex={-1}
            >
              <Link2Icon className="h-5 w-5" />
            </button>

            {/* Text Input & Placeholder */}
            <div className="relative flex-1">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={onKeyDown}
                disabled={disabled}
                placeholder={isActive && placeholder ? placeholder : ""}
                className="flex-1 border-0 outline-0 rounded-md py-2 text-base bg-transparent w-full font-normal disabled:opacity-50"
                style={{ position: "relative", zIndex: 1 }}
                onFocus={handleActivate}
              />
              <div className="absolute left-0 top-0 w-full h-full pointer-events-none flex items-center px-3 py-2">
                <AnimatePresence mode="wait">
                  {showPlaceholder && !isActive && !inputValue && (
                    <motion.span
                      key={placeholderIndex}
                      className="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 select-none text-studio-paper-muted-ink"
                      style={{
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        zIndex: 0,
                      }}
                      variants={placeholderContainerVariants}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                    >
                      {PLACEHOLDERS[placeholderIndex]
                        .split("")
                        .map((char, i) => (
                          <motion.span
                            key={i}
                            variants={letterVariants}
                            style={{ display: "inline-block" }}
                          >
                            {char === " " ? "\u00A0" : char}
                          </motion.span>
                        ))}
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {controls}
            <button
              className={`rounded-full p-3 transition ${micActive ? "bg-studio-danger/15 text-studio-danger hover:bg-studio-danger/20" : "hover:bg-studio-paper-muted disabled:cursor-not-allowed disabled:opacity-50"}`}
              title="Voice input"
              type="button"
              tabIndex={-1}
              onClick={onMicClick}
              disabled={disabled}
            >
              <Mic size={20} />
            </button>
            <button
              className="flex items-center justify-center gap-1 rounded-full bg-studio-action p-3 font-medium text-studio-action-ink transition hover:bg-studio-action-strong disabled:cursor-not-allowed disabled:opacity-50"
              title="Send"
              type="button"
              tabIndex={-1}
              onClick={onSubmit}
              disabled={disabled}
            >
              <PaperPlaneIcon className="h-4 w-4" />
            </button>
          </div>

          {/* Expanded Controls */}
          <motion.div
            className="w-full flex justify-start px-4 items-center text-sm"
            variants={{
              hidden: {
                opacity: 0,
                y: 20,
                pointerEvents: "none" as const,
                transition: { duration: 0.25 },
              },
              visible: {
                opacity: 1,
                y: 0,
                pointerEvents: "auto" as const,
                transition: { duration: 0.35, delay: 0.08 },
              },
            }}
            initial="hidden"
            animate={isActive || inputValue ? "visible" : "hidden"}
            style={{ marginTop: 8 }}
          >
            <div className="flex gap-3 items-center">
              {/* Think Toggle */}
              <button
                className={`flex items-center gap-1 px-4 py-2 rounded-full transition-all font-medium group ${
                  thinkActive
                    ? "bg-studio-paper-muted text-studio-paper-ink outline outline-1 outline-studio-action-strong"
                    : "bg-studio-paper-muted/70 text-studio-paper-muted-ink hover:bg-studio-paper-muted"
                }`}
                title="Think"
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setThinkActive((a) => !a);
                }}
              >
                <LightningBoltIcon className={`h-4 w-4 transition-colors ${thinkActive ? "text-studio-warning-ink" : "text-studio-paper-muted-ink"}`} />
                Think
              </button>

              {/* Deep Search Toggle */}
              <motion.button
                className={`flex items-center px-4 gap-1 py-2 rounded-full transition font-medium whitespace-nowrap overflow-hidden justify-start  ${
                  deepSearchActive
                    ? "bg-studio-paper-muted text-studio-paper-ink outline outline-1 outline-studio-action-strong"
                    : "bg-studio-paper-muted/70 text-studio-paper-muted-ink hover:bg-studio-paper-muted"
                }`}
                title="Deep Search"
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeepSearchActive((a) => !a);
                }}
                initial={false}
                animate={{
                  width: deepSearchActive ? 125 : 36,
                  paddingLeft: deepSearchActive ? 8 : 9,
                }}
              >
                <div className="flex-1">
                  <GlobeIcon className="h-[18px] w-[18px]" />
                </div>
                <motion.span
                className="pb-[2px]"
                  initial={false}
                  animate={{
                    opacity: deepSearchActive ? 1 : 0,
                  }}
                >
                  Deep Search
                </motion.span>
              </motion.button>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
};

export { AIChatInput };
