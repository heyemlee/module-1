import { describe, expect, test } from "vitest";
import { createDefaultShowroomForm } from "@/features/round1/showroom-intake-data";
import type { LLMProvider } from "@/server/llm/provider";
import {
  ROUND1_AGENT_TOOLS,
  createRound1AgentContext,
  executeRound1AgentTool,
  runRound1AgentTurn
} from "./agent-service";

function getUpdateIntakeOvenMicrowaveConfigurationEnum(): string[] {
  const updateIntakeTool = ROUND1_AGENT_TOOLS.find(
    (tool) => tool.name === "update_intake"
  );
  const parameters = updateIntakeTool?.parameters as {
    properties?: {
      layoutSensitiveCabinets?: {
        properties?: {
          ovenMicrowave?: {
            properties?: {
              configuration?: { enum?: string[] };
            };
          };
        };
      };
    };
  };

  return (
    parameters.properties?.layoutSensitiveCabinets?.properties?.ovenMicrowave
      ?.properties?.configuration?.enum ?? []
  );
}

describe("executeRound1AgentTool", () => {
  test("update_intake merges a valid nested patch and exposes the updated form", async () => {
    const ctx = createRound1AgentContext(createDefaultShowroomForm());

    const result = (await executeRound1AgentTool(
      "update_intake",
      { room: { length: 144 }, layoutPreference: "U_SHAPE" },
      ctx
    )) as { ok: boolean };

    expect(result.ok).toBe(true);
    expect(ctx.updatedForm).not.toBeNull();
    expect(ctx.updatedForm?.room.length).toBe(144);
    expect(ctx.updatedForm?.layoutPreference).toBe("U_SHAPE");
    // Untouched fields are preserved by the deep merge.
    expect(ctx.updatedForm?.fixtures.sink.size).toBe(33);
  });

  test("agent tool accepts separate wall oven and microwave arrangement", async () => {
    const form = createDefaultShowroomForm();
    const ctx = createRound1AgentContext(form);

    const result = await executeRound1AgentTool(
      "update_intake",
      {
        layoutSensitiveCabinets: {
          ovenMicrowave: {
            configuration: "SEPARATE_WALL_OVEN_AND_MICROWAVE"
          }
        }
      },
      ctx
    );

    expect(result).not.toHaveProperty("error");
    expect(
      ctx.updatedForm?.layoutSensitiveCabinets.ovenMicrowave.configuration
    ).toBe("SEPARATE_WALL_OVEN_AND_MICROWAVE");
  });

  test("update_intake tool schema advertises separate wall oven and microwave arrangement", () => {
    expect(getUpdateIntakeOvenMicrowaveConfigurationEnum()).toContain(
      "SEPARATE_WALL_OVEN_AND_MICROWAVE"
    );
  });

  test("update_intake rejects an invalid value without mutating the form", async () => {
    const ctx = createRound1AgentContext(createDefaultShowroomForm());

    const result = (await executeRound1AgentTool(
      "update_intake",
      { fixtures: { sink: { size: 99 } } },
      ctx
    )) as { ok: boolean; issues?: unknown[] };

    expect(result.ok).toBe(false);
    expect(ctx.updatedForm).toBeNull();
  });

  test("update_intake strips control fields it must not own", async () => {
    const ctx = createRound1AgentContext(createDefaultShowroomForm());

    await executeRound1AgentTool(
      "update_intake",
      {
        room: { length: 120 },
        cabinetFillGenerated: true,
        fixedPositionsConfirmed: true,
        snapshot: { tampered: true }
      } as Record<string, unknown>,
      ctx
    );

    expect(ctx.updatedForm).not.toBeNull();
    expect(ctx.updatedForm).not.toHaveProperty("cabinetFillGenerated");
    expect(ctx.updatedForm).not.toHaveProperty("fixedPositionsConfirmed");
    expect(ctx.updatedForm).not.toHaveProperty("snapshot");
  });

  test("estimate_cabinets returns a summary stamped sales-estimate-only", async () => {
    const ctx = createRound1AgentContext(createDefaultShowroomForm());

    const result = (await executeRound1AgentTool(
      "estimate_cabinets",
      {},
      ctx
    )) as {
      totalCabinets: number;
      salesEstimateOnly: boolean;
      notForProduction: boolean;
      note: string;
    };

    expect(result.totalCabinets).toBeGreaterThan(0);
    expect(result.salesEstimateOnly).toBe(true);
    expect(result.notForProduction).toBe(true);
    expect(result.note.toLowerCase()).toContain("not for production");
  });

  test("explain_confirmations lists current confirmation items", async () => {
    const ctx = createRound1AgentContext(createDefaultShowroomForm());

    const result = (await executeRound1AgentTool(
      "explain_confirmations",
      {},
      ctx
    )) as { count: number; confirmationItems: Array<{ code: string }> };

    expect(result.count).toBe(result.confirmationItems.length);
    // The default form has no ceiling height, so it must flag that.
    expect(result.confirmationItems.map((item) => item.code)).toContain(
      "MISSING_CEILING_HEIGHT"
    );
  });

  test("unknown tool returns an error rather than throwing", async () => {
    const ctx = createRound1AgentContext(createDefaultShowroomForm());
    const result = (await executeRound1AgentTool("nope", {}, ctx)) as {
      error: string;
    };
    expect(result.error).toContain("Unknown tool");
  });
});

describe("runRound1AgentTurn", () => {
  test("propagates the agent's form edits back to the caller", async () => {
    const provider: LLMProvider = {
      name: "fake",
      model: "fake",
      async runAgentLoop(input, executeTool) {
        const result = (await executeTool("update_intake", {
          room: { length: 156 }
        })) as { ok: boolean };
        expect(result.ok).toBe(true);
        return { reply: "Updated the room.", toolCallsMade: ["update_intake"] };
      }
    };

    const turn = await runRound1AgentTurn(
      { message: "13 foot wall", form: createDefaultShowroomForm() },
      { provider }
    );

    expect(turn.reply).toBe("Updated the room.");
    expect(turn.updatedForm?.room.length).toBe(156);
    expect(turn.toolCallsMade).toEqual(["update_intake"]);
  });

  test("returns no updatedForm when the agent only reads", async () => {
    const provider: LLMProvider = {
      name: "fake",
      model: "fake",
      async runAgentLoop(_input, executeTool) {
        await executeTool("estimate_cabinets", {});
        return { reply: "Roughly a dozen cabinets.", toolCallsMade: ["estimate_cabinets"] };
      }
    };

    const turn = await runRound1AgentTurn(
      { message: "how many cabinets?", form: createDefaultShowroomForm() },
      { provider }
    );

    expect(turn.updatedForm).toBeUndefined();
    expect(turn.reply).toContain("dozen");
  });
});
