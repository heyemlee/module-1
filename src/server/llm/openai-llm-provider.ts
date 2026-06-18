import {
  DEFAULT_AGENT_MAX_ITERATIONS,
  LLMProviderNotConfiguredError,
  type AgentInput,
  type AgentOutput,
  type LLMProvider,
  type ToolExecutor,
  type ToolSpec
} from "./provider";

type FetchImpl = typeof fetch;

const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";

type OpenAIToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

type OpenAIMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
};

type OpenAIChatResponse = {
  choices?: Array<{ message?: OpenAIMessage }>;
};

/**
 * Shared OpenAI-compatible (`/chat/completions` + `tools`) agent loop. Both the
 * OpenAI and DeepSeek providers use this; DeepSeek only differs by base URL,
 * model, and key. The loop is vendor-agnostic apart from those inputs.
 */
export async function runOpenAICompatibleAgentLoop(
  config: { baseUrl: string; apiKey: string; model: string; fetchImpl: FetchImpl },
  input: AgentInput,
  executeTool: ToolExecutor
): Promise<AgentOutput> {
  const maxIterations = input.maxIterations ?? DEFAULT_AGENT_MAX_ITERATIONS;
  const knownTools = new Set(input.tools.map((tool) => tool.name));
  const toolCallsMade: string[] = [];

  const messages: OpenAIMessage[] = [
    { role: "system", content: input.systemPrompt },
    ...input.history.map((turn) => ({ role: turn.role, content: turn.content })),
    { role: "user", content: input.userMessage }
  ];

  const tools = input.tools.map((tool) => toOpenAITool(tool));

  let lastAssistantText = "";

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    const response = await config.fetchImpl(
      `${config.baseUrl}/chat/completions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
          model: config.model,
          messages,
          tools,
          tool_choice: "auto"
        })
      }
    );

    if (!response.ok) {
      const detail = await safeReadError(response);
      throw new Error(
        `LLM request failed with status ${response.status}${
          detail ? `: ${detail}` : ""
        }`
      );
    }

    const json = (await response.json()) as OpenAIChatResponse;
    const message = json.choices?.[0]?.message;
    if (!message) {
      throw new Error("LLM response did not include a message");
    }

    messages.push({
      role: "assistant",
      content: message.content ?? "",
      tool_calls: message.tool_calls
    });
    if (message.content) {
      lastAssistantText = message.content;
    }

    const toolCalls = message.tool_calls ?? [];
    if (toolCalls.length === 0) {
      return { reply: message.content ?? "", toolCallsMade };
    }

    for (const call of toolCalls) {
      toolCallsMade.push(call.function.name);
      const result = await runToolCall(
        call.function.name,
        call.function.arguments,
        knownTools,
        executeTool
      );
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(result)
      });
    }
  }

  // Hit the iteration cap mid-conversation. Return the best text we have plus a
  // note so the user knows the assistant stopped short rather than finished.
  return {
    reply:
      lastAssistantText ||
      "I gathered what I could but reached my step limit for this turn. Please refine or repeat your request.",
    toolCallsMade
  };
}

async function runToolCall(
  name: string,
  rawArgs: string,
  knownTools: Set<string>,
  executeTool: ToolExecutor
): Promise<unknown> {
  if (!knownTools.has(name)) {
    return { error: `Unknown tool: ${name}` };
  }
  let args: unknown;
  try {
    args = rawArgs ? JSON.parse(rawArgs) : {};
  } catch {
    return { error: "Tool arguments were not valid JSON." };
  }
  try {
    return await executeTool(name, args);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Tool execution failed."
    };
  }
}

function toOpenAITool(tool: ToolSpec) {
  return {
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters
    }
  };
}

async function safeReadError(response: Response): Promise<string> {
  try {
    const text = await response.text();
    return text.slice(0, 300);
  } catch {
    return "";
  }
}

/**
 * Builds an OpenAI chat provider from environment configuration. Throws
 * `LLMProviderNotConfiguredError` when `OPENAI_API_KEY` is absent.
 */
export function createOpenAILLMProvider(
  env: Record<string, string | undefined> = process.env,
  deps: { fetchImpl?: FetchImpl } = {}
): LLMProvider {
  const apiKey = env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new LLMProviderNotConfiguredError(
      "LLM_PROVIDER=openai but OPENAI_API_KEY is not set"
    );
  }
  const baseUrl = (env.OPENAI_BASE_URL?.trim() || DEFAULT_OPENAI_BASE_URL).replace(
    /\/+$/,
    ""
  );
  const model = env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL;
  const fetchImpl = deps.fetchImpl ?? globalThis.fetch;

  return {
    name: "openai",
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
