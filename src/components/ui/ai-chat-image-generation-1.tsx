"use client";

import * as React from "react";
import { motion } from "motion/react";

export interface ImageGenerationProps {
  children: React.ReactNode;
  active?: boolean;
}

export const ImageGeneration = ({ children, active = true }: ImageGenerationProps) => {
  const [progress, setProgress] = React.useState(active ? 0 : 100);
  const [loadingState, setLoadingState] = React.useState<
    "starting" | "generating" | "completed"
  >(active ? "starting" : "completed");
  const duration = 30000;

  React.useEffect(() => {
    if (!active) {
      setProgress(100);
      setLoadingState("completed");
      return;
    }

    setProgress(0);
    setLoadingState("starting");
    const startingTimeout = setTimeout(() => {
      setLoadingState("generating");

      const startTime = Date.now();

      const interval = setInterval(() => {
        const elapsedTime = Date.now() - startTime;
        const progressPercentage = Math.min(
          100,
          (elapsedTime / duration) * 100
        );

        setProgress(progressPercentage);

        if (progressPercentage >= 100) {
          clearInterval(interval);
          setLoadingState("completed");
        }
      }, 16);

      return () => clearInterval(interval);
    }, 3000);

    return () => clearTimeout(startingTimeout);
  }, [active, duration]);

  return (
    <div className="flex flex-col gap-2">
      {active ? (
        <motion.span
          className="bg-[linear-gradient(110deg,var(--color-muted-foreground,var(--app-muted)),35%,var(--color-foreground,var(--app-ink)),50%,var(--color-muted-foreground,var(--app-muted)),75%,var(--color-muted-foreground,var(--app-muted)))] bg-[length:200%_100%] bg-clip-text text-base font-medium text-transparent"
          initial={{ backgroundPosition: "200% 0" }}
          animate={{
            backgroundPosition:
              loadingState === "completed" ? "0% 0" : "-200% 0"
          }}
          transition={{
            repeat: loadingState === "completed" ? 0 : Infinity,
            duration: 3,
            ease: "linear"
          }}
        >
          {loadingState === "starting" && "Getting started."}
          {loadingState === "generating" && "Creating image. May take a moment."}
          {loadingState === "completed" && "Image created."}
        </motion.span>
      ) : null}
      <div className="relative max-w-md overflow-hidden rounded-xl border bg-card">
        {children}
        {active ? (
          <motion.div
            className="pointer-events-none absolute -top-[25%] h-[125%] w-full backdrop-blur-3xl"
            initial={false}
            animate={{
              clipPath: `polygon(0 ${progress}%, 100% ${progress}%, 100% 100%, 0 100%)`,
              opacity: loadingState === "completed" ? 0 : 1
            }}
            style={{
              clipPath: `polygon(0 ${progress}%, 100% ${progress}%, 100% 100%, 0 100%)`,
              maskImage:
                progress === 0
                  ? "linear-gradient(to bottom, black -5%, black 100%)"
                  : `linear-gradient(to bottom, transparent ${progress - 5}%, transparent ${progress}%, black ${progress + 5}%)`,
              WebkitMaskImage:
                progress === 0
                  ? "linear-gradient(to bottom, black -5%, black 100%)"
                  : `linear-gradient(to bottom, transparent ${progress - 5}%, transparent ${progress}%, black ${progress + 5}%)`
            }}
          />
        ) : null}
      </div>
    </div>
  );
};

ImageGeneration.displayName = "ImageGeneration";
