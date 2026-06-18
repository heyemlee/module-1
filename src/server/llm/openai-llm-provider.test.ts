import { describe, expect, test, vi } from "vitest";
import { createOpenAILLMProvider } from "./openai-llm-provider";
import { LLMProviderNotConfiguredError } from "./provider";

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    async json() {
      return body;
    },
    async text() {
      return JSON.stringify(body);
    }
  } as unknown as Response;
}

function toolCallResponse(name: string, args: unknown) {
  return jsonResponse({
    choices: [
      {
        message: {
          role: "assistant",
          content: null,
          tool_calls: [
            {
              id: "call_1",
              type: "function",
              function: { name, arguments: JSON.stringify(args) }
            }
          ]
        }
      }
    ]
  });
}

function finalResponse(text: string) {
  return jsonResponse({
    choices: [{ message: { role: "assistant", content: text } }]
  });
}

describe("createOpenAILLMProvider", () => {
  test("throws when OPENAI_API_KEY is missing", () => {
    expect(() => createOpenAILLMProvider({})).toThrow(
      LLMProviderNotConfiguredError
    );
  });

  test("runs the tool loop: calls the tool, feeds back the result, returns final reply", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(toolCallResponse("update_intake", { room: { length: 144 } }))
      .mockResolvedValueOnce(finalResponse("Set the room length to 144 inches."));

    const executeTool = vi.fn().mockResolvedValue({ ok: true });

    const provider = createOpenAILLMProvider(
      { OPENAI_API_KEY: "test-key", OPENAI_MODEL: "test-model" },
      { fetchImpl }
    );

    const result = await provider.runAgentLoop(
      {
        systemPrompt: "system",
        history: [],
        userMessage: "make the room 12 feet long",
        tools: [
          { name: "update_intake", description: "d", parameters: { type: "object" } }
        ]
      },
      executeTool
    );

    expect(result.reply).toBe("Set the room length to 144 inches.");
    expect(result.toolCallsMade).toEqual(["update_intake"]);
    expect(executeTool).toHaveBeenCalledWith("update_intake", {
      room: { length: 144 }
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);

    // The second request must include the tool result fed back to the model.
    const secondBody = JSON.parse(
      (fetchImpl.mock.calls[1][1] as RequestInit).body as string
    );
    const toolMessage = secondBody.messages.find(
      (m: { role: string }) => m.role === "tool"
    );
    expect(toolMessage).toBeTruthy();
    expect(JSON.parse(toolMessage.content)).toEqual({ ok: true });
  });

  test("does not execute unknown tools, reports an error back to the model", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(toolCallResponse("delete_everything", {}))
      .mockResolvedValueOnce(finalResponse("I can't do that."));

    const executeTool = vi.fn();

    const provider = createOpenAILLMProvider(
      { OPENAI_API_KEY: "test-key" },
      { fetchImpl }
    );

    const result = await provider.runAgentLoop(
      {
        systemPrompt: "system",
        history: [],
        userMessage: "delete the project",
        tools: [
          { name: "update_intake", description: "d", parameters: { type: "object" } }
        ]
      },
      executeTool
    );

    expect(executeTool).not.toHaveBeenCalled();
    expect(result.reply).toBe("I can't do that.");
    const secondBody = JSON.parse(
      (fetchImpl.mock.calls[1][1] as RequestInit).body as string
    );
    const toolMessage = secondBody.messages.find(
      (m: { role: string }) => m.role === "tool"
    );
    expect(JSON.parse(toolMessage.content).error).toContain("Unknown tool");
  });
});
