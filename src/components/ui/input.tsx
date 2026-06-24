import { cn } from "@/lib/utils";
import * as React from "react";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-studio-control border border-studio-line-strong bg-studio-surface px-3 py-2 text-sm text-studio-ink shadow-sm shadow-black/10 outline-none transition-[border-color,box-shadow] placeholder:text-studio-muted focus-visible:border-studio-action focus-visible:ring-[3px] focus-visible:ring-studio-action/20 disabled:cursor-not-allowed disabled:opacity-50 data-[surface=inspector]:border-studio-paper-muted data-[surface=inspector]:bg-studio-paper data-[surface=inspector]:text-studio-paper-ink data-[surface=inspector]:placeholder:text-[var(--app-muted)] data-[surface=inspector]:focus-visible:border-studio-action-strong data-[surface=inspector]:focus-visible:ring-studio-action/30",
          type === "search" &&
            "[&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none [&::-webkit-search-results-button]:appearance-none [&::-webkit-search-results-decoration]:appearance-none",
          type === "file" &&
            "p-0 pr-3 italic text-studio-muted file:me-3 file:h-full file:border-0 file:border-r file:border-solid file:border-studio-line-strong file:bg-transparent file:px-3 file:text-sm file:font-medium file:not-italic file:text-studio-ink data-[surface=inspector]:file:border-studio-paper-muted data-[surface=inspector]:file:text-studio-paper-ink",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
