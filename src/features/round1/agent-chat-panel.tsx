"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent
} from "react";
import RuixenQueryBox from "@/components/ui/ruixen-query-box";
import type { Round1FormInput } from "@/domain/round1";
import { Panel } from "./showroom-intake-controls";
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
  const [collapsed, setCollapsed] = useState(false);
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
    <Panel title="AI Intake Assistant">
      {notConfigured ? (
        <div className="rounded-lg bg-[var(--app-surface-muted)] p-3">
          <span className="inline-block rounded-full bg-black/10 px-2 py-1 text-xs font-bold text-[var(--app-muted)]">
            Not configured
          </span>
          <p className="mt-2 text-xs leading-5 text-[var(--app-muted)]">
            The conversational assistant is optional. Set <code>LLM_PROVIDER</code>{" "}
            and the matching API key to enable it.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-[var(--app-muted)]">
              Describe the kitchen in plain language. The assistant fills the form
              for you to review.
            </p>
            <button
              type="button"
              onClick={() => setCollapsed((value) => !value)}
              className="uiverse-fill-button ml-2 shrink-0 px-2 py-1 text-xs"
            >
              {collapsed ? "Expand" : "Hide"}
            </button>
          </div>

          {!collapsed && (
            <>
              <div
                ref={scrollRef}
                className="max-h-64 space-y-2 overflow-auto rounded-lg bg-[var(--app-surface-muted)] p-2"
              >
                {messages.length === 0 ? (
                  <p className="px-1 py-6 text-center text-xs text-[var(--app-quiet)]">
                    No messages yet. Try: &ldquo;12 by 10 foot kitchen, L-shape,
                    36&quot; sink, no island.&rdquo;
                  </p>
                ) : (
                  messages.map((message, index) => (
                    <div
                      key={index}
                      className={
                        message.role === "user"
                          ? "flex justify-end"
                          : "flex justify-start"
                      }
                    >
                      <div
                        className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${
                          message.role === "user"
                            ? "bg-[var(--app-blue)] text-white"
                            : "bg-white text-[var(--app-ink)] ring-1 ring-[var(--app-border)]"
                        }`}
                      >
                        {message.content}
                      </div>
                    </div>
                  ))
                )}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="rounded-lg bg-white px-3 py-2 text-sm text-[var(--app-muted)] ring-1 ring-[var(--app-border)]">
                      Thinking…
                    </div>
                  </div>
                )}
              </div>

              {(error || stt.error) && (
                <p className="rounded-lg bg-[var(--app-red-soft)] px-2 py-1 text-xs text-[var(--app-red)]">
                  {error ?? stt.error}
                </p>
              )}

              <RuixenQueryBox
                value={input}
                placeholder={
                  sttRecording
                    ? "Listening... speak now"
                    : "Ask anything about this kitchen..."
                }
                disabled={isLoading}
                micSupported={stt.supported}
                micActive={sttRecording}
                onValueChange={(value) =>
                  setInput(value.slice(0, MAX_INPUT_LENGTH))
                }
                onKeyDown={handleKeyDown}
                onMicClick={handleMicClick}
                onSend={() => void send()}
                controls={
                  stt.supported ? (
                    <button
                      type="button"
                      onClick={() =>
                        setSttLang((value) =>
                          value === "zh-CN" ? "en-US" : "zh-CN"
                        )
                      }
                      disabled={isLoading || sttRecording}
                      title="Dictation language"
                      className="rounded-full bg-gray-200 px-2.5 py-2 text-xs font-bold text-gray-600 transition hover:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {sttLang === "zh-CN" ? "中文" : "EN"}
                    </button>
                  ) : null
                }
              />
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-[var(--app-quiet)]">
                  {input.length}/{MAX_INPUT_LENGTH}
                </span>
                <span className="text-xs text-[var(--app-muted)]">
                  Enter to send · Shift+Enter for a new line
                </span>
              </div>
            </>
          )}
        </div>
      )}
    </Panel>
  );
}
