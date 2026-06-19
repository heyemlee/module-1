export function getAIStatus(env: Record<string, string | undefined> = process.env) {
  const provider = env.LLM_PROVIDER?.trim() || null;
  return {
    renderingEnabled: Boolean(env.OPENAI_API_KEY?.trim()),
    agentEnabled:
      provider === "openai"
        ? Boolean(env.OPENAI_API_KEY?.trim())
        : provider === "deepseek"
          ? Boolean(env.DEEPSEEK_API_KEY?.trim())
          : provider === "anthropic"
            ? Boolean(env.ANTHROPIC_API_KEY?.trim())
            : false,
    provider,
    chatModel:
      provider === "openai"
        ? env.OPENAI_MODEL?.trim() || "gpt-4o-mini"
        : provider === "deepseek"
          ? env.DEEPSEEK_MODEL?.trim() || "deepseek-chat"
          : provider === "anthropic"
            ? env.ANTHROPIC_MODEL?.trim() || "claude-haiku-4-5-20251001"
            : null,
    imageModel: env.OPENAI_IMAGE_MODEL?.trim() || "gpt-image-2"
  };
}
