"use client";

import { Mic, SendHorizonal, Upload } from "lucide-react";
import { useRef } from "react";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

export default function RuixenQueryBox({
  value,
  placeholder = "Ask anything...",
  disabled = false,
  micActive = false,
  micSupported = true,
  onValueChange,
  onSend,
  onMicClick,
  onFileUpload,
  onKeyDown,
  controls
}: {
  value: string;
  placeholder?: string;
  disabled?: boolean;
  micActive?: boolean;
  micSupported?: boolean;
  onValueChange: (value: string) => void;
  onSend: () => void;
  onMicClick?: () => void;
  onFileUpload?: (files: FileList | null) => void;
  onKeyDown?: React.KeyboardEventHandler<HTMLTextAreaElement>;
  controls?: React.ReactNode;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="w-full px-0 py-0">
      <div
        className="relative mx-auto max-w-2xl overflow-hidden rounded-2xl border border-gray-300 bg-white shadow-sm"
        style={{
          backgroundImage:
            "url('https://pub-940ccf6255b54fa799a9b01050e6c227.r2.dev/ruixen_chat_gradient.png')",
          backgroundSize: "cover",
          backgroundPosition: "center"
        }}
      >
        <Textarea
          id="ai-textarea"
          placeholder={placeholder}
          className={cn(
            "w-full resize-none border-none bg-transparent",
            "px-5 py-4 pr-32 text-base leading-[1.4] text-white placeholder:text-gray-400",
            "rounded-2xl transition-all focus-visible:ring-0 focus-visible:ring-offset-0"
          )}
          value={value}
          disabled={disabled}
          onChange={(event) => onValueChange(event.target.value)}
          onKeyDown={onKeyDown}
        />

        <div className="absolute bottom-3 right-3 flex items-center gap-2">
          {micSupported ? (
            <button
              type="button"
              onClick={onMicClick}
              disabled={disabled}
              className={cn(
                "rounded-full bg-gray-200 p-2 text-gray-600 transition-colors hover:bg-gray-300",
                micActive && "bg-red-100 text-red-700"
              )}
            >
              <Mic className="h-4 w-4" />
            </button>
          ) : null}

          {onFileUpload ? (
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="rounded-full bg-gray-200 p-2 text-gray-600 transition-colors hover:bg-gray-300"
                >
                  <Upload className="h-4 w-4" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-60 p-4">
                <p className="mb-2 text-sm">Upload files:</p>
                <input
                  type="file"
                  multiple
                  ref={fileInputRef}
                  onChange={(event) => onFileUpload(event.target.files)}
                  className="w-full rounded border border-gray-300 p-1"
                />
                <Button
                  className="mt-2 w-full"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Choose Files
                </Button>
              </PopoverContent>
            </Popover>
          ) : null}

          {controls}

          <button
            type="button"
            onClick={onSend}
            disabled={disabled || !value.trim()}
            className={cn(
              "rounded-full p-2 transition-colors",
              value.trim() && !disabled
                ? "bg-[#004a58] text-white"
                : "cursor-not-allowed bg-gray-200 text-gray-400"
            )}
          >
            <SendHorizonal className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
