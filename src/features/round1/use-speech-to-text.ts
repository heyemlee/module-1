"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Thin React wrapper around the browser Web Speech API (SpeechRecognition).
 * Client-only, zero-dependency, no server round-trip. Used by the AI Intake
 * Assistant so a sales rep can dictate the customer's requirements instead of
 * typing; the transcript is placed into the textarea for review before sending.
 *
 * The Web Speech API takes a single recognition `lang`, so the caller chooses
 * zh-CN or en-US; mixed-language is best-effort within the selected language.
 */

export type SttLang = "zh-CN" | "en-US";

// Minimal local typings — the Web Speech API is not in the standard TS DOM lib
// and is exposed under a vendor prefix in Chromium-based browsers.
interface SpeechRecognitionAlternativeLike {
  readonly transcript: string;
}
interface SpeechRecognitionResultLike {
  readonly isFinal: boolean;
  readonly length: number;
  readonly [index: number]: SpeechRecognitionAlternativeLike;
}
interface SpeechRecognitionResultListLike {
  readonly length: number;
  readonly [index: number]: SpeechRecognitionResultLike;
}
interface SpeechRecognitionEventLike {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultListLike;
}
interface SpeechRecognitionErrorEventLike {
  readonly error: string;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function getSpeechRecognitionCtor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") {
    return null;
  }
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function describeError(code: string): string {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "Microphone permission denied. Allow it in the browser and retry.";
    case "no-speech":
      return "No speech detected. Try again.";
    case "audio-capture":
      return "No microphone found.";
    case "network":
      return "Speech recognition network error.";
    case "aborted":
      return ""; // user/programmatic stop — not surfaced as an error
    default:
      return `Speech recognition error (${code}).`;
  }
}

export type UseSpeechToText = {
  supported: boolean;
  recording: boolean;
  error: string | null;
  start: () => void;
  stop: () => void;
  clearError: () => void;
};

export function useSpeechToText({
  lang,
  onResult
}: {
  lang: SttLang;
  /** Called with the cumulative transcript (final + interim) of the session. */
  onResult: (transcript: string) => void;
}): UseSpeechToText {
  const [supported, setSupported] = useState(false);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  // Keep latest callback/lang in refs so the live recognition handlers always
  // use current values without re-creating the recognition instance.
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;
  const langRef = useRef(lang);
  langRef.current = lang;

  // Detect support after mount to avoid SSR/hydration mismatch (window is
  // undefined on the server, so both server and first client render show false).
  useEffect(() => {
    setSupported(getSpeechRecognitionCtor() !== null);
  }, []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const start = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setError("This browser does not support voice input.");
      return;
    }
    if (recognitionRef.current) {
      recognitionRef.current.abort();
      recognitionRef.current = null;
    }
    const recognition = new Ctor();
    recognition.lang = langRef.current;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => {
      setError(null);
      setRecording(true);
    };
    recognition.onresult = (event) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i += 1) {
        transcript += event.results[i][0].transcript;
      }
      onResultRef.current(transcript);
    };
    recognition.onerror = (event) => {
      const message = describeError(event.error);
      if (message) {
        setError(message);
      }
      setRecording(false);
    };
    recognition.onend = () => {
      setRecording(false);
      recognitionRef.current = null;
    };
    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      // start() throws if called while already started; ignore.
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  // Stop any in-flight recognition on unmount.
  useEffect(
    () => () => {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    },
    []
  );

  return { supported, recording, error, start, stop, clearError };
}
