/**
 * Provider-agnostic LLM tool-use layer for the optional Round 1 conversational
 * intake agent. Business code depends ONLY on these interfaces; the concrete
 * vendor (openai | deepseek | anthropic) is selected at runtime by
 * `getLLMProvider` (see ./index.ts) from environment configuration.
 *
 * The provider runs a bounded tool-use loop: it sends the conversation to the
 * model, executes any tool calls the model requests via the supplied
 * `executeTool` callback, feeds the results back, and repeats until the model
 * produces a final natural-language reply (or the iteration cap is hit).
 *
 * AI boundary: this layer never owns Round 1 data. The tools it can call are
 * defined by the caller (the agent service) and wrap deterministic domain
 * functions. The model may fill fields and relay deterministic output; it may
 * not invent counts/dimensions/geometry/readiness or freeze/save a snapshot.
 */

/** A single tool the model may call. `parameters` is a JSON Schema object. */
export interface ToolSpec {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

/** One prior conversation turn, supplied by the client for context. */
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AgentInput {
  systemPrompt: string;
  /** Prior turns (oldest first). The provider appends `userMessage` after these. */
  history: ChatMessage[];
  userMessage: string;
  tools: ToolSpec[];
  /** Hard cap on model<->tool round trips. Defaults to 6. */
  maxIterations?: number;
}

export interface AgentOutput {
  /** Final natural-language reply shown to the user. */
  reply: string;
  /** Names of tools the model invoked this turn, in call order. */
  toolCallsMade: string[];
}

/**
 * Executes a single tool call. Returns a JSON-serializable result that is fed
 * back to the model. It must NOT throw for ordinary tool failures — return an
 * `{ error }`-shaped object instead so the model can recover within the loop.
 */
export type ToolExecutor = (
  name: string,
  args: unknown
) => Promise<unknown>;

export interface LLMProvider {
  readonly name: string;
  readonly model: string;
  runAgentLoop(
    input: AgentInput,
    executeTool: ToolExecutor
  ): Promise<AgentOutput>;
}

export const DEFAULT_AGENT_MAX_ITERATIONS = 6;

/**
 * Thrown when no LLM provider is configured (missing `LLM_PROVIDER` or the
 * matching API key). The API route maps this to a 503 so the UI can render a
 * graceful "not configured" state instead of a hard error.
 */
export class LLMProviderNotConfiguredError extends Error {
  readonly code = "LLM_PROVIDER_NOT_CONFIGURED";
  constructor(message = "No LLM provider is configured") {
    super(message);
    this.name = "LLMProviderNotConfiguredError";
  }
}
