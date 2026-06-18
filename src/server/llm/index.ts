import { createAnthropicLLMProvider } from "./anthropic-llm-provider";
import { createDeepSeekLLMProvider } from "./deepseek-llm-provider";
import { createOpenAILLMProvider } from "./openai-llm-provider";
import {
  LLMProviderNotConfiguredError,
  type LLMProvider
} from "./provider";

export * from "./provider";

/**
 * Selects the configured LLM provider from environment. Switch vendor with
 * `LLM_PROVIDER=openai|deepseek|anthropic` plus the matching API key (and an
 * optional `OPENAI_MODEL` / `DEEPSEEK_MODEL` / `ANTHROPIC_MODEL` override).
 *
 * Throws `LLMProviderNotConfiguredError` when `LLM_PROVIDER` is unset/unknown or
 * the selected provider's key is missing. Callers (the API route) map this to a
 * 503 so the UI can show a graceful "not configured" state.
 */
export function getLLMProvider(
  env: Record<string, string | undefined> = process.env
): LLMProvider {
  const provider = (env.LLM_PROVIDER ?? "").trim().toLowerCase();
  switch (provider) {
    case "openai":
      return createOpenAILLMProvider(env);
    case "deepseek":
      return createDeepSeekLLMProvider(env);
    case "anthropic":
      return createAnthropicLLMProvider(env);
    case "":
      throw new LLMProviderNotConfiguredError(
        "LLM_PROVIDER is not set. Set it to openai, deepseek, or anthropic."
      );
    default:
      throw new LLMProviderNotConfiguredError(
        `Unknown LLM_PROVIDER "${provider}". Use openai, deepseek, or anthropic.`
      );
  }
}
