/**
 * On-demand agent eval — NOT a CI gate. Measures the two numbers ai-eval-plan.md
 * Phase 1 cares about, per model, so you can compare a small vs a strong model:
 *
 *   (1) NL→patch accuracy   did the model fill the fields the dialogue states?
 *   (2) schema-reject rate  how often update_intake came back ok:false — i.e. the
 *                           model emitted a shape Zod rejected and had to retry
 *                           inside the agent loop (the latency/token cost of NOT
 *                           using constrained decoding). Reported as rejects/calls.
 *   (+) avg tool calls per scenario.
 *
 * Two kinds of case, both run as a `turns[]` conversation (history accumulates,
 * one shared form across turns):
 *   - micro:    one utterance, one field-mapping under test.
 *   - scenario: the full multi-step intake dialogues of docs/test-dialogues.md
 *               (Room→Openings→Layout→Appliances), one turn per step that carries
 *               customer content. Drag/rendering/quota steps are NOT agent work
 *               (full-flow.test.ts + rendering tests own those), so they are not
 *               turns here.
 *
 * Checks assert ONLY agent-owned fields (the update_intake allowlist: room dims +
 * ceiling, layoutPreference, openings.*.status, sink/range/fridge/dishwasher,
 * island, ovenMicrowave.configuration). Expected values are chosen to DIFFER from
 * createDefaultShowroomForm() so a no-op model cannot score a pass.
 *
 * Hits a real (paid) LLM, so it stays OFF unless RUN_AGENT_EVAL=1 and an API key
 * are set. Normal `vitest run` / CI stay $0 and deterministic.
 *
 * Provider is switchable via EVAL_PROVIDER (openai | anthropic | deepseek); each
 * needs its own key. Models to compare come from EVAL_MODELS (default: a small +
 * a strong model for the chosen provider).
 *
 * Run:
 *   # OpenAI (default): gpt-4o-mini vs gpt-4o
 *   RUN_AGENT_EVAL=1 OPENAI_API_KEY=sk-... npx vitest run src/server/round1/agent-eval.test.ts
 *   # Claude: haiku vs sonnet
 *   RUN_AGENT_EVAL=1 EVAL_PROVIDER=anthropic ANTHROPIC_API_KEY=sk-ant-... \
 *     npx vitest run src/server/round1/agent-eval.test.ts
 *   # override models / endpoint:
 *   ... EVAL_MODELS=gpt-4o-mini,gpt-4o [OPENAI_BASE_URL=...] ...
 */
import { describe, expect, test } from "vitest";
import type { Round1FormInput } from "@/domain/round1";
import { createDefaultShowroomForm } from "@/features/round1/showroom-intake-data";
import { createAnthropicLLMProvider } from "@/server/llm/anthropic-llm-provider";
import { createDeepSeekLLMProvider } from "@/server/llm/deepseek-llm-provider";
import { createOpenAILLMProvider } from "@/server/llm/openai-llm-provider";
import type { ChatMessage, LLMProvider } from "@/server/llm/provider";
import {
  ROUND1_AGENT_SYSTEM_PROMPT,
  ROUND1_AGENT_TOOLS,
  createRound1AgentContext,
  executeRound1AgentTool
} from "./agent-service";

// A check returns null when satisfied, else a short mismatch description.
type Check = (form: Round1FormInput) => string | null;
type Case = { id: string; turns: string[]; checks: Check[] };

function get(obj: unknown, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (o, k) => (o == null ? o : (o as Record<string, unknown>)[k]),
      obj
    );
}

function eq(path: string, expected: unknown): Check {
  return (form) => {
    const actual = get(form, path);
    return actual === expected
      ? null
      : `${path}=${JSON.stringify(actual)} (want ${JSON.stringify(expected)})`;
  };
}

function oneOf(path: string, allowed: unknown[]): Check {
  return (form) => {
    const actual = get(form, path);
    return allowed.includes(actual)
      ? null
      : `${path}=${JSON.stringify(actual)} (want one of ${JSON.stringify(allowed)})`;
  };
}

function gt(path: string, min: number): Check {
  return (form) => {
    const actual = get(form, path);
    return typeof actual === "number" && actual > min
      ? null
      : `${path}=${JSON.stringify(actual)} (want > ${min})`;
  };
}

function matches(path: string, re: RegExp): Check {
  return (form) => {
    const actual = get(form, path);
    return typeof actual === "string" && re.test(actual)
      ? null
      : `${path}=${JSON.stringify(actual)} (want match ${re})`;
  };
}

// Stays at the starting default — used for adversarial "must not invent" checks.
function unchanged(path: string): Check {
  const base = get(createDefaultShowroomForm(), path);
  return (form) => {
    const actual = get(form, path);
    return actual === base
      ? null
      : `${path} became ${JSON.stringify(actual)} (must stay ${JSON.stringify(base)})`;
  };
}

// --- micro cases: one utterance, one mapping under test ----------------------
const MICRO: Case[] = [
  {
    id: "micro/en-basic-U",
    turns: ["12 by 10 foot kitchen, U-shape, 36 inch sink, no island."],
    checks: [
      eq("room.length", 144), // 12 ft × 12
      eq("layoutPreference", "U_SHAPE"),
      eq("fixtures.sink.size", 36),
      eq("layoutSensitiveCabinets.island.status", "NO")
    ]
  },
  {
    id: "micro/zh-feet-galley",
    turns: ["厨房十二尺乘十尺，走廊型 galley 就行。"],
    checks: [
      eq("room.length", 144), // 尺 = feet, ×12 → inches (NOT metric chi)
      eq("room.width", 120),
      eq("layoutPreference", "GALLEY")
    ]
  },
  {
    id: "micro/zh-separate-om",
    turns: ["我家壁挂烤箱和微波炉是分开两个地方装的。"],
    checks: [
      eq(
        "layoutSensitiveCabinets.ovenMicrowave.configuration",
        "SEPARATE_WALL_OVEN_AND_MICROWAVE"
      )
    ]
  },
  {
    id: "micro/en-appliances-rightL",
    turns: [
      "Right-hand L-shape. 48 inch gas range, and a 42 inch French-door fridge."
    ],
    checks: [
      eq("layoutPreference", "RIGHT_L_SHAPE"),
      eq("fixtures.range.size", 48),
      eq("fixtures.fridge.size", 42)
    ]
  },
  {
    id: "micro/zh-onewall-dw18",
    turns: ["一字型一面墙的厨房，洗碗机要小的 18 寸，不要岛台。"],
    checks: [
      eq("layoutPreference", "ONE_WALL"),
      eq("fixtures.dishwasher.size", 18),
      eq("layoutSensitiveCabinets.island.status", "NO")
    ]
  },
  {
    id: "micro/en-induction-fuel",
    turns: ["Galley kitchen with a 30 inch induction range."],
    checks: [
      eq("layoutPreference", "GALLEY"),
      eq("fixtures.range.size", 30),
      matches("fixtures.range.fuel", /induct|electric/i)
    ]
  }
];

// --- scenario cases: the full multi-step dialogues of docs/test-dialogues.md --
// Turns mirror the customer (or, for 5/6, the rep's one-shot spec) content of each
// agent-relevant step. Checks assert the accumulated end-state.
const SCENARIOS: Case[] = [
  {
    // Scenario 1: oversized dims + U + island + oven/microwave stack.
    // Agent should pass the oversized number through (clamping is normalize's job,
    // locked by full-flow.test.ts) and not fabricate a "reasonable" small one.
    id: "scenario/1-oversized-U-stack",
    turns: [
      "我家大平层，厨房特别大。长度一千英尺，宽度八百，差不多 100 by 8000 那么大。层高不知道，先空着。",
      "有一个门，前面进来那个；后墙有一扇大窗。",
      "U 型，必须 U 型；要个大岛台。",
      "水槽灶冰箱洗碗机全套都有。单独壁挂烤箱，加内嵌微波，叠一起那种叠塔。"
    ],
    checks: [
      gt("room.length", 600), // oversized passed through, not invented-small
      eq("room.ceilingHeight", null),
      eq("layoutPreference", "U_SHAPE"),
      eq("layoutSensitiveCabinets.island.status", "YES"),
      eq(
        "layoutSensitiveCabinets.ovenMicrowave.configuration",
        "WALL_OVEN_MICROWAVE_STACK"
      ),
      eq("openings.doors.status", "YES"),
      eq("openings.windows.status", "YES")
    ]
  },
  {
    // Scenario 2: term confusion; LEFT_L; island genuinely unknown; countertop
    // (non-built-in) microwave; vague dims must NOT be fabricated.
    id: "scenario/2-terms-leftL-unknownIsland",
    turns: [
      "厨房多大我也说不好，就一般家里那样吧。",
      "门我有一个真的门，还有一个没门扇的过道开口；窗户有，但我不知道在哪面墙。",
      "形状就那个拐角的、往左拐的 L 型。岛台是中间那个台子吧？不知道要不要。",
      "水槽冰箱灶洗碗机都有。普通烤箱，微波就放台面上，不是嵌墙的。"
    ],
    checks: [
      unchanged("room.length"), // vague → no fabricated dimension
      unchanged("room.width"),
      eq("layoutPreference", "LEFT_L_SHAPE"),
      eq("layoutSensitiveCabinets.island.status", "UNKNOWN"),
      eq(
        "layoutSensitiveCabinets.ovenMicrowave.configuration",
        "COUNTERTOP_MICROWAVE"
      ),
      eq("openings.doors.status", "YES"),
      eq("openings.windows.status", "YES")
    ]
  },
  {
    // Scenario 3: maximal customer — U + island + full appliances + stack tower.
    id: "scenario/3-maximal-U-island-stack",
    turns: [
      "长 240，宽 180。层高 9 尺，也就是 108 英寸。",
      "一个门在前面，两扇窗，左墙右墙各一扇。",
      "U 型，带岛台，必须带。",
      "水槽要大双槽，洗手台、灶、冰箱、洗碗机全部都有。单独壁挂烤箱 high-end 的，内嵌微波 building 的，烤箱和微波叠一起叠塔。"
    ],
    checks: [
      eq("room.length", 240),
      eq("room.width", 180),
      eq("room.ceilingHeight", 108), // 9 ft = 108 in
      eq("layoutPreference", "U_SHAPE"),
      eq("layoutSensitiveCabinets.island.status", "YES"),
      eq(
        "layoutSensitiveCabinets.ovenMicrowave.configuration",
        "WALL_OVEN_MICROWAVE_STACK"
      ),
      eq("openings.doors.status", "YES"),
      eq("openings.windows.status", "YES")
    ]
  },
  {
    // Scenario 4: everything unknown — the hardest "don't guess" case. The model
    // must leave dims/layout/island/oven unknown rather than inventing values.
    id: "scenario/4-allUnknown-noguess",
    turns: [
      "长度一般多少就多少吧，差不多那么大；宽度不知道，反正方方正正；层高 I don't know, leave it blank。",
      "门应该有吧，记不清了；窗也不确定。",
      "形状没想法，你给我推荐；岛台也不知道要不要。",
      "水槽冰箱灶应该都要吧，具体型号尺寸我真不知道；烤箱微波也不确定。"
    ],
    checks: [
      unchanged("room.length"),
      unchanged("room.width"),
      eq("room.ceilingHeight", null),
      oneOf("layoutPreference", ["NO_PREFERENCE", "LEFT_L_SHAPE"]),
      eq("layoutSensitiveCabinets.island.status", "UNKNOWN"),
      eq("layoutSensitiveCabinets.ovenMicrowave.configuration", "UNKNOWN")
    ]
  },
  {
    // Scenario 5: rep types the whole spec in one shot (one-shot multi-field).
    id: "scenario/5-oneshot-L-noIsland",
    turns: [
      "长 200 宽 150，层高 96，一个门两扇窗，L 型不要岛，水槽冰箱灶洗碗机都有，普通配置。"
    ],
    checks: [
      eq("room.length", 200),
      eq("room.width", 150),
      eq("room.ceilingHeight", 96),
      eq("layoutPreference", "LEFT_L_SHAPE"),
      eq("layoutSensitiveCabinets.island.status", "NO"),
      eq("openings.doors.status", "YES"),
      eq("openings.windows.status", "YES")
    ]
  },
  {
    // Scenario 6: stacking — U, no island, oven/microwave stack tower.
    id: "scenario/6-stack-U-noIsland",
    turns: [
      "长 216 宽 168，层高 102，一个门一扇窗，U 型，不要岛。",
      "内嵌微波装在烤箱正上方，叠着的，壁挂烤箱加内嵌微波叠塔。"
    ],
    checks: [
      eq("room.length", 216),
      eq("room.width", 168),
      eq("room.ceilingHeight", 102),
      eq("layoutPreference", "U_SHAPE"),
      eq("layoutSensitiveCabinets.island.status", "NO"),
      eq(
        "layoutSensitiveCabinets.ovenMicrowave.configuration",
        "WALL_OVEN_MICROWAVE_STACK"
      ),
      eq("openings.doors.status", "YES"),
      eq("openings.windows.status", "YES")
    ]
  }
];

const CASES: Case[] = [...MICRO, ...SCENARIOS];

// Mirrors runRound1AgentTurn but (a) threads multiple turns through one shared
// form + accumulating history, and (b) instruments the tool executor so we can
// tally update_intake rejects (the retry signal) without touching production code.
async function runScenario(provider: LLMProvider, turns: string[]) {
  const ctx = createRound1AgentContext(createDefaultShowroomForm());
  const history: ChatMessage[] = [];
  let toolCalls = 0;
  let intakeCalls = 0;
  let intakeRejects = 0;

  for (const turn of turns) {
    const output = await provider.runAgentLoop(
      {
        systemPrompt: ROUND1_AGENT_SYSTEM_PROMPT,
        history: [...history],
        userMessage: turn,
        tools: ROUND1_AGENT_TOOLS
      },
      async (name, args) => {
        toolCalls += 1;
        const result = await executeRound1AgentTool(name, args, ctx);
        if (name === "update_intake") {
          intakeCalls += 1;
          if ((result as { ok?: boolean }).ok === false) intakeRejects += 1;
        }
        return result;
      }
    );
    history.push(
      { role: "user", content: turn },
      { role: "assistant", content: output.reply ?? "" }
    );
  }

  return { form: ctx.form, toolCalls, intakeCalls, intakeRejects };
}

const PROVIDER = (process.env.EVAL_PROVIDER ?? "openai").toLowerCase();
const KEY_ENV: Record<string, string> = {
  openai: "OPENAI_API_KEY",
  deepseek: "DEEPSEEK_API_KEY",
  anthropic: "ANTHROPIC_API_KEY"
};
const DEFAULT_MODELS: Record<string, string> = {
  openai: "gpt-4o-mini,gpt-4o",
  deepseek: "deepseek-chat",
  anthropic: "claude-haiku-4-5-20251001,claude-sonnet-4-6"
};

function makeProvider(model: string): LLMProvider {
  switch (PROVIDER) {
    case "anthropic":
      return createAnthropicLLMProvider({ ...process.env, ANTHROPIC_MODEL: model });
    case "deepseek":
      return createDeepSeekLLMProvider({ ...process.env, DEEPSEEK_MODEL: model });
    default:
      return createOpenAILLMProvider({ ...process.env, OPENAI_MODEL: model });
  }
}

const RUN =
  process.env.RUN_AGENT_EVAL === "1" &&
  Boolean(process.env[KEY_ENV[PROVIDER] ?? "OPENAI_API_KEY"]);
const MODELS = (process.env.EVAL_MODELS ?? DEFAULT_MODELS[PROVIDER] ?? "gpt-4o-mini,gpt-4o")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

describe.skipIf(!RUN)("agent NL→patch eval (paid, on-demand)", () => {
  test(
    "accuracy + schema-reject rate per model",
    async () => {
      const summary: Record<string, string>[] = [];

      for (const model of MODELS) {
        const provider = makeProvider(model);
        let pass = 0;
        let intakeCalls = 0;
        let intakeRejects = 0;
        let toolCalls = 0;
        const failures: string[] = [];

        // Sequential: avoids rate limits and keeps the cost obvious.
        for (const c of CASES) {
          try {
            const r = await runScenario(provider, c.turns);
            intakeCalls += r.intakeCalls;
            intakeRejects += r.intakeRejects;
            toolCalls += r.toolCalls;
            const misses = c.checks
              .map((check) => check(r.form))
              .filter((m): m is string => m !== null);
            if (misses.length === 0) pass += 1;
            else failures.push(`  ✗ ${c.id}: ${misses.join("; ")}`);
          } catch (error) {
            failures.push(
              `  ✗ ${c.id}: ERROR ${error instanceof Error ? error.message : error}`
            );
          }
        }

        summary.push({
          model,
          accuracy: `${pass}/${CASES.length} (${Math.round((pass / CASES.length) * 100)}%)`,
          schemaRejects: `${intakeRejects}/${intakeCalls}`,
          avgToolCalls: (toolCalls / CASES.length).toFixed(1)
        });
        // eslint-disable-next-line no-console
        console.log(
          `\n=== ${model} ===\n${failures.length ? failures.join("\n") : "  (all cases passed)"}`
        );
      }

      // eslint-disable-next-line no-console
      console.table(summary);
      // The eval is a report, not an accuracy gate — only assert it actually ran.
      expect(summary).toHaveLength(MODELS.length);
    },
    600_000
  );
});
