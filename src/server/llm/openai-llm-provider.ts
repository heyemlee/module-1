import {
  DEFAULT_AGENT_MAX_ITERATIONS,
  LLMProviderNotConfiguredError,
  type AgentInput,
  type AgentOutput,
  type LLMProvider,
  type ToolExecutor,
  type ToolSpec
} from "./provider";
import { getPreferredOpenAIApiKey } from "@/infrastructure/openai-api-keys";

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
          tool_choice: "auto",
          // The CRS relay only accepts streaming requests; OpenAI/DeepSeek also
          // support it, so stream unconditionally and aggregate the deltas.
          stream: true
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

    const message = await readStreamedAssistantMessage(response);

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

/**
 * The relay (and OpenAI/DeepSeek) stream chat completions as
 * `chat.completion.chunk` SSE. Reassemble the deltas into one assistant
 * message: concatenate content, and merge tool_call fragments by index (id +
 * name arrive in the first fragment, then argument text streams in chunks).
 */
async function readStreamedAssistantMessage(
  response: Response
): Promise<OpenAIMessage> {
  const text = await response.text();
  let content = "";
  const calls = new Map<number, OpenAIToolCall>();

  for (const line of text.split(/\r?\n/)) {
    if (!line.startsWith("data:")) continue;
    const payload = line.slice(5).trim();
    if (!payload || payload === "[DONE]") continue;
    let chunk: {
      choices?: Array<{
        delta?: {
          content?: string | null;
          tool_calls?: Array<{
            index: number;
            id?: string;
            function?: { name?: string; arguments?: string };
          }>;
        };
      }>;
    };
    try {
      chunk = JSON.parse(payload);
    } catch {
      continue;
    }
    const delta = chunk.choices?.[0]?.delta;
    if (!delta) continue;
    if (typeof delta.content === "string") content += delta.content;
    for (const fragment of delta.tool_calls ?? []) {
      let slot = calls.get(fragment.index);
      if (!slot) {
        slot = { id: "", type: "function", function: { name: "", arguments: "" } };
        calls.set(fragment.index, slot);
      }
      if (fragment.id) slot.id = fragment.id;
      if (fragment.function?.name) slot.function.name += fragment.function.name;
      if (fragment.function?.arguments) {
        slot.function.arguments += fragment.function.arguments;
      }
    }
  }

  const toolCalls = [...calls.keys()]
    .sort((a, b) => a - b)
    .map((key) => calls.get(key)!);

  return {
    role: "assistant",
    content: content || null,
    tool_calls: toolCalls.length > 0 ? toolCalls : undefined
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
 * `LLMProviderNotConfiguredError` when no prioritized OpenAI API key is set.
 */
export function createOpenAILLMProvider(
  env: Record<string, string | undefined> = process.env,
  deps: { fetchImpl?: FetchImpl } = {}
): LLMProvider {
  const keyConfig = getPreferredOpenAIApiKey(env);
  if (!keyConfig) {
    throw new LLMProviderNotConfiguredError(
      "LLM_PROVIDER=openai but no prioritized OpenAI API key is set"
    );
  }
  const baseUrl = (keyConfig.baseUrl || DEFAULT_OPENAI_BASE_URL).replace(
    /\/+$/,
    ""
  );
  const apiKey = keyConfig.apiKey;
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
