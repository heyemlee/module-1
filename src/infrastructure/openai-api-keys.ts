const DEFAULT_OPENAI_API_KEY_PRIORITY = ["PRIMARY", "SECONDARY", "TERTIARY"] as const;

const OPENAI_API_KEY_ENV_BY_SLOT = {
  PRIMARY: "OPENAI_API_KEY_PRIMARY",
  SECONDARY: "OPENAI_API_KEY_SECONDARY",
  TERTIARY: "OPENAI_API_KEY_TERTIARY"
} as const;

const OPENAI_BASE_URL_ENV_BY_SLOT = {
  PRIMARY: "OPENAI_BASE_URL_PRIMARY",
  SECONDARY: "OPENAI_BASE_URL_SECONDARY",
  TERTIARY: "OPENAI_BASE_URL_TERTIARY"
} as const;

export type OpenAIApiKeySlot = keyof typeof OPENAI_API_KEY_ENV_BY_SLOT;

export type ConfiguredOpenAIApiKey = {
  slot: OpenAIApiKeySlot;
  apiKey: string;
  baseUrl?: string;
};

export function getConfiguredOpenAIApiKeys(
  env: Record<string, string | undefined> = process.env
): ConfiguredOpenAIApiKey[] {
  return getOpenAIApiKeyPriority(env)
    .flatMap((slot): ConfiguredOpenAIApiKey[] => {
      const apiKey = env[OPENAI_API_KEY_ENV_BY_SLOT[slot]]?.trim();
      if (!apiKey) return [];
      const baseUrl = env[OPENAI_BASE_URL_ENV_BY_SLOT[slot]]?.trim();
      return [{ slot, apiKey, ...(baseUrl ? { baseUrl } : {}) }];
    });
}

export function getPreferredOpenAIApiKey(
  env: Record<string, string | undefined> = process.env
): ConfiguredOpenAIApiKey | null {
  return getConfiguredOpenAIApiKeys(env)[0] ?? null;
}

export function hasConfiguredOpenAIApiKey(
  env: Record<string, string | undefined> = process.env
): boolean {
  return getConfiguredOpenAIApiKeys(env).length > 0;
}

function getOpenAIApiKeyPriority(
  env: Record<string, string | undefined>
): OpenAIApiKeySlot[] {
  const requested = (env.OPENAI_API_KEY_PRIORITY ?? "")
    .split(",")
    .map((slot) => slot.trim().toUpperCase())
    .filter(isOpenAIApiKeySlot);

  const priority =
    requested.length > 0 ? requested : [...DEFAULT_OPENAI_API_KEY_PRIORITY];
  return [...priority, ...DEFAULT_OPENAI_API_KEY_PRIORITY].filter(
    (slot, index, slots) => slots.indexOf(slot) === index
  );
}

function isOpenAIApiKeySlot(slot: string): slot is OpenAIApiKeySlot {
  return slot in OPENAI_API_KEY_ENV_BY_SLOT;
}
