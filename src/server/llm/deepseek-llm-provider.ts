import { runOpenAICompatibleAgentLoop } from "./openai-llm-provider";
import {
  LLMProviderNotConfiguredError,
  type LLMProvider
} from "./provider";

type FetchImpl = typeof fetch;

// DeepSeek exposes an OpenAI-compatible `/chat/completions` endpoint with the
// same `tools` / `tool_calls` shape, so the shared loop is reused. It is kept in
// its own module (not a bare URL swap) so any future DeepSeek-specific quirks in
// request/response handling have a dedicated place to live.
const DEEPSEEK_BASE_URL = "https://api.deepseek.com/v1";
const DEFAULT_DEEPSEEK_MODEL = "deepseek-chat";

/**
 * Builds a DeepSeek chat provider from environment configuration. Throws
 * `LLMProviderNotConfiguredError` when `DEEPSEEK_API_KEY` is absent.
 */
export function createDeepSeekLLMProvider(
  env: Record<string, string | undefined> = process.env,
  deps: { fetchImpl?: FetchImpl } = {}
): LLMProvider {
  const apiKey = env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) {
    throw new LLMProviderNotConfiguredError(
      "LLM_PROVIDER=deepseek but DEEPSEEK_API_KEY is not set"
    );
  }
  const baseUrl = (env.DEEPSEEK_BASE_URL?.trim() || DEEPSEEK_BASE_URL).replace(
    /\/+$/,
    ""
  );
  const model = env.DEEPSEEK_MODEL?.trim() || DEFAULT_DEEPSEEK_MODEL;
  const fetchImpl = deps.fetchImpl ?? globalThis.fetch;

  return {
    name: "deepseek",
    model,
    runAgentLoop(input, executeTool) {
      return runOpenAICompatibleAgentLoop(
        { baseUrl, apiKey, model, fetchImpl },
        input,
        executeTool
      );
    }
  };
}
