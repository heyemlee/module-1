"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent
} from "react";
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
        <div className="rounded-md bg-slate-50 p-3">
          <span className="inline-block rounded bg-slate-200 px-2 py-1 text-xs font-bold text-slate-600">
            Not configured
          </span>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            The conversational assistant is optional. Set <code>LLM_PROVIDER</code>{" "}
            and the matching API key to enable it.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">
              Describe the kitchen in plain language. The assistant fills the form
              for you to review.
            </p>
            <button
              type="button"
              onClick={() => setCollapsed((value) => !value)}
              className="ml-2 shrink-0 rounded border border-slate-200 px-2 py-1 text-xs font-bold text-slate-600 hover:bg-slate-50"
            >
              {collapsed ? "Expand" : "Hide"}
            </button>
          </div>

          {!collapsed && (
            <>
              <div
                ref={scrollRef}
                className="max-h-64 space-y-2 overflow-auto rounded-md bg-slate-50 p-2"
              >
                {messages.length === 0 ? (
                  <p className="px-1 py-6 text-center text-xs text-slate-400">
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
                            ? "bg-sky-700 text-white"
                            : "bg-white text-slate-800 ring-1 ring-slate-200"
                        }`}
                      >
                        {message.content}
                      </div>
                    </div>
                  ))
                )}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="rounded-lg bg-white px-3 py-2 text-sm text-slate-500 ring-1 ring-slate-200">
                      Thinking…
                    </div>
                  </div>
                )}
              </div>

              {(error || stt.error) && (
                <p className="rounded-md bg-red-50 px-2 py-1 text-xs text-red-700">
                  {error ?? stt.error}
                </p>
              )}

              <textarea
                value={input}
                onChange={(event) =>
                  setInput(event.target.value.slice(0, MAX_INPUT_LENGTH))
                }
                onKeyDown={handleKeyDown}
                rows={3}
                placeholder={
                  sttRecording
                    ? "Listening… speak now"
                    : "Describe the kitchen… (Enter to send, Shift+Enter for a new line)"
                }
                disabled={isLoading}
                className="w-full resize-none rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-700 disabled:bg-slate-50"
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
                        className={`flex h-9 w-9 items-center justify-center rounded-md border disabled:cursor-not-allowed disabled:opacity-50 ${
                          sttRecording
                            ? "animate-pulse border-red-300 bg-red-50 text-red-600"
                            : "border-slate-300 text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        <MicIcon />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setSttLang((value) =>
                            value === "zh-CN" ? "en-US" : "zh-CN"
                          )
                        }
                        disabled={isLoading || sttRecording}
                        title="Dictation language"
                        className="rounded-md border border-slate-300 px-2 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {sttLang === "zh-CN" ? "中文" : "EN"}
                      </button>
                      {sttRecording && (
                        <span className="text-xs font-bold text-red-600">
                          ● Recording
                        </span>
                      )}
                    </>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400">
                    {input.length}/{MAX_INPUT_LENGTH}
                  </span>
                  <button
                    type="button"
                    onClick={() => void send()}
                    disabled={isLoading || input.trim().length === 0}
                    className="rounded-md bg-sky-700 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Send
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </Panel>
  );
}

function MicIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}
