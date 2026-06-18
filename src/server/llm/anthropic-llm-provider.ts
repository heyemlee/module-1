import {
  DEFAULT_AGENT_MAX_ITERATIONS,
  LLMProviderNotConfiguredError,
  type AgentInput,
  type AgentOutput,
  type LLMProvider,
  type ToolExecutor
} from "./provider";

type FetchImpl = typeof fetch;

const DEFAULT_ANTHROPIC_BASE_URL = "https://api.anthropic.com/v1";
const DEFAULT_ANTHROPIC_MODEL = "claude-haiku-4-5-20251001";
const ANTHROPIC_VERSION = "2023-06-01";
const ANTHROPIC_MAX_TOKENS = 1024;

type AnthropicTextBlock = { type: "text"; text: string };
type AnthropicToolUseBlock = {
  type: "tool_use";
  id: string;
  name: string;
  input: unknown;
};
type AnthropicToolResultBlock = {
  type: "tool_result";
  tool_use_id: string;
  content: string;
};
type AnthropicContentBlock =
  | AnthropicTextBlock
  | AnthropicToolUseBlock
  | AnthropicToolResultBlock;

type AnthropicMessage = {
  role: "user" | "assistant";
  content: string | AnthropicContentBlock[];
};

type AnthropicResponse = {
  content?: AnthropicContentBlock[];
  stop_reason?: string;
};

/**
 * Anthropic Messages API provider. Same bounded tool-use loop as the
 * OpenAI-compatible providers, but Anthropic uses `tool_use` / `tool_result`
 * content blocks instead of the `tool_calls` / `role:"tool"` shape, so it needs
 * its own loop. Throws `LLMProviderNotConfiguredError` when `ANTHROPIC_API_KEY`
 * is absent.
 */
export function createAnthropicLLMProvider(
  env: Record<string, string | undefined> = process.env,
  deps: { fetchImpl?: FetchImpl } = {}
): LLMProvider {
  const apiKey = env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw new LLMProviderNotConfiguredError(
      "LLM_PROVIDER=anthropic but ANTHROPIC_API_KEY is not set"
    );
  }
  const baseUrl = (
    env.ANTHROPIC_BASE_URL?.trim() || DEFAULT_ANTHROPIC_BASE_URL
  ).replace(/\/+$/, "");
  const model = env.ANTHROPIC_MODEL?.trim() || DEFAULT_ANTHROPIC_MODEL;
  const fetchImpl = deps.fetchImpl ?? globalThis.fetch;

  return {
    name: "anthropic",
    model,
    async runAgentLoop(
      input: AgentInput,
      executeTool: ToolExecutor
    ): Promise<AgentOutput> {
      const maxIterations = input.maxIterations ?? DEFAULT_AGENT_MAX_ITERATIONS;
      const knownTools = new Set(input.tools.map((tool) => tool.name));
      const toolCallsMade: string[] = [];

      const tools = input.tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        input_schema: tool.parameters
      }));

      const messages: AnthropicMessage[] = [
        ...input.history.map((turn) => ({
          role: turn.role,
          content: turn.content
        })),
        { role: "user", content: input.userMessage }
      ];

      let lastAssistantText = "";

      for (let iteration = 0; iteration < maxIterations; iteration += 1) {
        const response = await fetchImpl(`${baseUrl}/messages`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": ANTHROPIC_VERSION
          },
          body: JSON.stringify({
            model,
            max_tokens: ANTHROPIC_MAX_TOKENS,
            system: input.systemPrompt,
            messages,
            tools
          })
        });

        if (!response.ok) {
          const detail = await safeReadError(response);
          throw new Error(
            `LLM request failed with status ${response.status}${
              detail ? `: ${detail}` : ""
            }`
          );
        }

        const json = (await response.json()) as AnthropicResponse;
        const blocks = json.content ?? [];
        messages.push({ role: "assistant", content: blocks });

        const text = blocks
          .filter((block): block is AnthropicTextBlock => block.type === "text")
          .map((block) => block.text)
          .join("");
        if (text) {
          lastAssistantText = text;
        }

        const toolUses = blocks.filter(
          (block): block is AnthropicToolUseBlock => block.type === "tool_use"
        );

        if (json.stop_reason !== "tool_use" || toolUses.length === 0) {
          return { reply: text, toolCallsMade };
        }

        const results: AnthropicToolResultBlock[] = [];
        for (const toolUse of toolUses) {
          toolCallsMade.push(toolUse.name);
          const result = await runToolCall(
            toolUse.name,
            toolUse.input,
            knownTools,
            executeTool
          );
          results.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: JSON.stringify(result)
          });
        }
        messages.push({ role: "user", content: results });
      }

      return {
        reply:
          lastAssistantText ||
          "I gathered what I could but reached my step limit for this turn. Please refine or repeat your request.",
        toolCallsMade
      };
    }
  };
}

async function runToolCall(
  name: string,
  args: unknown,
  knownTools: Set<string>,
  executeTool: ToolExecutor
): Promise<unknown> {
  if (!knownTools.has(name)) {
    return { error: `Unknown tool: ${name}` };
  }
  try {
    return await executeTool(name, args);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Tool execution failed."
    };
  }
}

async function safeReadError(response: Response): Promise<string> {
  try {
    const text = await response.text();
    return text.slice(0, 300);
  } catch {
    return "";
  }
}
