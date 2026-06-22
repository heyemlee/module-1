"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent
} from "react";
import { Bot, Mic, Send } from "lucide-react";
import type { Round1FormInput } from "@/domain/round1";
import { cn } from "@/components/ui/cn";
import { useSpeechToText, type SttLang } from "./use-speech-to-text";

type ChatMessage = { role: "user" | "assistant"; content: string };

const MAX_INPUT_LENGTH = 500;
const HISTORY_TURNS_SENT = 10;

/**
 * Optional conversational Round 1 intake assistant. The sales rep describes the
 * customer's kitchen in natural language; the agent fills the live form through
 * `onFormUpdate` (the same path manual edits use), so the deterministic SVG
 * preview updates in place and snapshot staleness rules still apply.
 *
 * AI boundary: the panel only ever calls `onFormUpdate`. It cannot freeze or
 * save the snapshot — that stays on the human "Generate Cabinet Fill" button.
 */
export function AgentChatPanel({
  form,
  onFormUpdate
}: {
  form: Round1FormInput;
  onFormUpdate: (form: Round1FormInput) => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);
  const [sttLang, setSttLang] = useState<SttLang>("zh-CN");
  const scrollRef = useRef<HTMLDivElement | null>(null);
  // Text typed before a dictation session starts; the transcript is appended to
  // it so speech adds to (rather than replaces) what the rep already typed.
  const baseInputRef = useRef("");

  // Default dictation language to the browser locale, then let the user toggle.
  useEffect(() => {
    if (
      typeof navigator !== "undefined" &&
      navigator.language?.toLowerCase().startsWith("en")
    ) {
      setSttLang("en-US");
    }
  }, []);

  const stt = useSpeechToText({
    lang: sttLang,
    onResult: (transcript) => {
      const base = baseInputRef.current;
      const joined = base && transcript ? `${base} ${transcript}` : base + transcript;
      setInput(joined.slice(0, MAX_INPUT_LENGTH));
    }
  });
  const { recording: sttRecording, stop: sttStop } = stt;

  const handleMicClick = useCallback(() => {
    if (sttRecording) {
      sttStop();
      return;
    }
    baseInputRef.current = input;
    stt.start();
  }, [input, stt, sttRecording, sttStop]);

  const send = useCallback(async () => {
    if (sttRecording) {
      sttStop();
    }
    const text = input.trim();
    if (!text || isLoading) {
      return;
    }
    const history = messages.slice(-HISTORY_TURNS_SENT);
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/round1/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, form, history })
      });

      if (response.status === 503) {
        setNotConfigured(true);
        return;
      }
      if (!response.ok) {
        throw new Error(`Request failed (${response.status})`);
      }

      const json = (await response.json()) as {
        reply: string;
        updatedForm?: Round1FormInput;
      };
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: json.reply || "(no reply)" }
      ]);
      if (json.updatedForm) {
        onFormUpdate(json.updatedForm);
      }
      // Defer scroll until after the new message renders.
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
      });
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Something went wrong."
      );
    } finally {
      setIsLoading(false);
    }
  }, [form, input, isLoading, messages, onFormUpdate, sttRecording, sttStop]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        void send();
      }
    },
    [send]
  );

  return (
    <div className="flex h-full flex-col border-l border-border bg-surface">
      <header className="flex shrink-0 items-center justify-between border-b border-border bg-background px-4 py-3">
        <div className="flex items-center gap-2">
          <Bot size={16} className="text-info" />
          <h3 className="text-sm font-semibold text-foreground">AI Assistant</h3>
        </div>
        {!notConfigured && stt.supported && (
          <button
            type="button"
            onClick={() => setSttLang((value) => (value === "zh-CN" ? "en-US" : "zh-CN"))}
            disabled={isLoading || sttRecording}
            title="Dictation language"
            className="rounded-md bg-surface-2 px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
          >
            {sttLang === "zh-CN" ? "中文" : "EN"}
          </button>
        )}
      </header>

      {notConfigured ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
          <span className="rounded-md bg-surface-2 px-2 py-1 text-xs font-medium text-muted-foreground">
            Not configured
          </span>
          <p className="text-xs leading-5 text-muted-foreground">
            The conversational assistant is optional. Set <code className="font-mono">LLM_PROVIDER</code> and
            the matching API key to enable it.
          </p>
        </div>
      ) : (
        <>
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.length === 0 ? (
              <p className="px-2 py-8 text-center text-xs leading-5 text-subtle-foreground">
                Describe the kitchen in plain language and the assistant fills the form for you. Try:
                &ldquo;12 by 10 foot kitchen, L-shape, 36&quot; sink, no island.&rdquo;
              </p>
            ) : (
              messages.map((message, index) => (
                <div
                  key={index}
                  className={message.role === "user" ? "flex justify-end" : "flex items-start gap-2"}
                >
                  {message.role === "assistant" && (
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-info/10 text-info">
                      <Bot size={13} />
                    </span>
                  )}
                  <div
                    className={cn(
                      "max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm",
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "border border-border bg-background text-foreground"
                    )}
                  >
                    {message.content}
                  </div>
                </div>
              ))
            )}
            {isLoading && (
              <div className="flex items-start gap-2">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-info/10 text-info">
                  <Bot size={13} />
                </span>
                <div className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-muted-foreground">
                  Thinking…
                </div>
              </div>
            )}
          </div>

          <div className="shrink-0 space-y-2 border-t border-border p-3">
            {(error || stt.error) && (
              <p className="rounded-md bg-danger-surface px-2 py-1 text-xs text-danger-foreground">
                {error ?? stt.error}
              </p>
            )}
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value.slice(0, MAX_INPUT_LENGTH))}
              onKeyDown={handleKeyDown}
              rows={3}
              placeholder={
                sttRecording
                  ? "Listening… speak now"
                  : "Describe the kitchen… (Enter to send, Shift+Enter for a new line)"
              }
              disabled={isLoading}
              className="w-full resize-none rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent/40 disabled:opacity-60"
            />
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                {stt.supported && (
                  <>
                    <button
                      type="button"
                      onClick={handleMicClick}
                      disabled={isLoading}
                      aria-label={sttRecording ? "Stop dictation" : "Start voice dictation"}
                      title={sttRecording ? "Stop dictation" : "Dictate by voice"}
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-md border transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                        sttRecording
                          ? "animate-pulse border-danger/40 bg-danger-surface text-danger-foreground"
                          : "border-border text-muted-foreground hover:bg-surface-2"
                      )}
                    >
                      <Mic size={16} />
                    </button>
                    {sttRecording && (
                      <span className="text-xs font-medium text-danger-foreground">● Recording</span>
                    )}
                  </>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs text-subtle-foreground">
                  {input.length}/{MAX_INPUT_LENGTH}
                </span>
                <button
                  type="button"
                  onClick={() => void send()}
                  disabled={isLoading || input.trim().length === 0}
                  className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Send size={14} />
                  Send
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
