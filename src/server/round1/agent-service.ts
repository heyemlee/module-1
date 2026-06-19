import {
  generatePreliminaryCabinetList,
  normalizeRound1Form,
  round1FormSchema,
  summarizePreliminaryCabinetEstimate,
  type Round1FormInput
} from "@/domain/round1";
import { createDefaultCabinetRuns } from "@/features/round1/showroom-intake-data";
import { getLLMProvider } from "@/server/llm";
import type {
  ChatMessage,
  LLMProvider,
  ToolSpec
} from "@/server/llm/provider";

// Internal relation vocabulary shared across the form. Exposed to the model as a
// closed enum so `update_intake` patches stay schema-valid.
const RELATION_VALUES = [
  "BACK_SIDE",
  "LEFT_SIDE",
  "RIGHT_SIDE",
  "FRONT_SIDE",
  "NEAR_ENTRANCE",
  "UNDER_WINDOW",
  "ON_MAIN_RUN",
  "ON_ISLAND",
  "NEAR_SINK",
  "NEAR_RANGE",
  "NEAR_FRIDGE",
  "BEHIND_SINK",
  "ABOVE_RANGE",
  "NEAR_PANTRY",
  "NEAR_PREP_AREA",
  "NO_PREFERENCE",
  "NOT_APPLICABLE",
  "UNKNOWN"
] as const;

const relationSchemaFragment = {
  type: "string",
  enum: RELATION_VALUES
} as const;

/**
 * JSON Schema for `update_intake`. It is an ALLOWLIST: only layout-critical
 * Round 1 form fields appear here, nested to mirror the real form structure so
 * the model understands field relationships. Fields the agent must never own
 * (cabinet generation, position confirmation, snapshot freeze) are deliberately
 * absent and additionally stripped by Zod on merge. `additionalProperties` is
 * left open per-object so partial patches are easy, but unknown keys are dropped
 * by `round1FormSchema` during validation.
 */
const UPDATE_INTAKE_PARAMETERS: Record<string, unknown> = {
  type: "object",
  description:
    "Partial Round 1 intake fields to set. Only include fields you are confident about; omit the rest. Sizes are in inches.",
  properties: {
    room: {
      type: "object",
      properties: {
        length: { type: ["number", "null"], description: "Room length in inches" },
        width: { type: ["number", "null"], description: "Room width in inches" },
        ceilingHeight: { type: ["number", "null"], description: "Ceiling height in inches" },
        dimensionsKnown: { type: "boolean" }
      }
    },
    layoutPreference: {
      type: "string",
      enum: [
        "ONE_WALL",
        "LEFT_L_SHAPE",
        "RIGHT_L_SHAPE",
        "U_SHAPE",
        "GALLEY",
        "PENINSULA",
        "NO_PREFERENCE"
      ]
    },
    openings: {
      type: "object",
      properties: {
        doors: {
          type: "object",
          properties: { status: { type: "string", enum: ["YES", "NO", "UNKNOWN"] } }
        },
        windows: {
          type: "object",
          properties: { status: { type: "string", enum: ["YES", "NO", "UNKNOWN"] } }
        }
      }
    },
    fixtures: {
      type: "object",
      properties: {
        sink: {
          type: "object",
          properties: {
            size: { enum: [30, 33, 36, null] },
            relation: relationSchemaFragment
          }
        },
        range: {
          type: "object",
          properties: {
            size: { enum: [30, 36, 48, null] },
            fuel: { type: "string", description: "e.g. GAS, ELECTRIC, INDUCTION, UNKNOWN" },
            fixedLocation: { type: "string", enum: ["YES", "NO", "UNKNOWN"] },
            relation: relationSchemaFragment
          }
        },
        fridge: {
          type: "object",
          properties: {
            size: { enum: [30, 33, 36, 42, 48, null] },
            relation: relationSchemaFragment
          }
        },
        dishwasher: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["YES", "NONE", "UNKNOWN"] },
            size: { enum: [18, 24, null] },
            relation: relationSchemaFragment
          }
        }
      }
    },
    layoutSensitiveCabinets: {
      type: "object",
      properties: {
        island: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["YES", "NO", "UNKNOWN"] },
            requested: { type: "boolean" }
          }
        },
        ovenMicrowave: {
          type: "object",
          properties: {
            configuration: {
              type: "string",
              enum: [
                "RANGE_INCLUDES_OVEN",
                "WALL_OVEN_MICROWAVE_STACK",
                "SEPARATE_WALL_OVEN_AND_MICROWAVE",
                "MICROWAVE_DRAWER",
                "UPPER_CABINET_MICROWAVE",
                "COUNTERTOP_MICROWAVE",
                "NO_MICROWAVE",
                "NO_OVEN",
                "UNKNOWN"
              ]
            }
          }
        }
      }
    }
  }
};

export const ROUND1_AGENT_TOOLS: ToolSpec[] = [
  {
    name: "update_intake",
    description:
      "Set or change layout-critical Round 1 intake fields from the customer's description (room size, layout shape, openings, sink/range/fridge/dishwasher, island, oven/microwave). Returns the resulting Confirmation Required items. Use this whenever the user states a concrete requirement.",
    parameters: UPDATE_INTAKE_PARAMETERS
  },
  {
    name: "estimate_cabinets",
    description:
      "Compute the rough preliminary cabinet estimate (base/wall/tall counts, linear feet, filler) from the current intake. Read-only. The result is a sales estimate only, never production data.",
    parameters: { type: "object", properties: {} }
  },
  {
    name: "explain_confirmations",
    description:
      "List the current Confirmation Required items (missing or approximate info that sales/the customer must confirm). Read-only.",
    parameters: { type: "object", properties: {} }
  }
];

export const ROUND1_AGENT_SYSTEM_PROMPT = `You are a showroom sales intake assistant for Round 1 of a kitchen cabinet project. Your job is to help the sales rep translate a customer's natural-language description into the structured intake form, and to explain rough estimates.

You have three tools:
- update_intake: set layout-critical form fields. Call it whenever the user states a concrete requirement (dimensions, layout shape, appliances, island, openings). Only include fields you are confident about.
- estimate_cabinets: get the rough preliminary cabinet estimate. Read-only.
- explain_confirmations: list what still needs confirmation. Read-only.

Hard rules (never violate):
- This is a ROUGH SALES ESTIMATE ONLY. It is NOT production-ready and NOT a manufacturing drawing. When you report any estimate, say "rough sales estimate only, not for production".
- Never invent cabinet counts, dimensions, geometry, or measurements. Only relay numbers returned by the tools.
- Never claim the design is final, confirmed, or production-ready.
- You cannot freeze, save, or finalize anything. Freezing the Round 1 snapshot is done by the human via the "Generate Cabinet Fill" button only. If asked to finalize/save/lock, explain that the sales rep must do it on screen.
- Do not close or dismiss Confirmation Required items. They are resolved by gathering real information, not by you hiding them.
- Unknown values are allowed and expected; leave them unknown and let them remain Confirmation Required rather than guessing.

Units and measurements:
- Every dimension in the form is stored in INCHES. Convert all measurements to inches BEFORE calling update_intake.
- This is a US cabinet showroom. Treat 尺 / 呎 / foot / feet / ft / ' as FEET (multiply by 12 to get inches). Treat 寸 / 英寸 / inch / inches / in / " as INCHES. Do NOT interpret 尺 as the mainland-China metric chi (1/3 m).
- Convert cm (divide by 2.54) and m (multiply by 39.37) to inches as well.
- When you state a dimension back to the user, label the unit CORRECTLY: use inches / 英寸 / 寸 for inch values and feet / 尺 for foot values. Never call an inch value "尺". It is fine to show both, e.g. "168 inches (14 ft)" / "168 英寸（14 尺）".

Language:
- Reply in the SAME language the user wrote in — Chinese, English, or mixed Chinese/English — and match their phrasing.
- Parse requirements stated in any of those languages, or mixed, and map them to the correct form fields with the same precision regardless of language.

Cooking appliances:
- A range (炉灶/燃气灶, burners + oven in one unit) and a cooktop (炉头/灶台, burners only, NO oven) are mutually exclusive primary cooking surfaces. Set exactly one of them to YES, never both. A separate wall oven or microwave/oven combo can coexist with either.
- If the customer says the microwave is above the wall oven, stacked with the wall oven, or in the same tall appliance cabinet, set layoutSensitiveCabinets.ovenMicrowave.configuration = "WALL_OVEN_MICROWAVE_STACK"; the update_intake tool will keep the appliance statuses consistent.
- If the customer says the wall oven and microwave are separate, set layoutSensitiveCabinets.ovenMicrowave.configuration = "SEPARATE_WALL_OVEN_AND_MICROWAVE"; the update_intake tool will keep the appliance statuses consistent.
- If the wall oven/microwave arrangement is unclear, leave layoutSensitiveCabinets.ovenMicrowave.configuration = "UNKNOWN".

Island:
- For L-shaped kitchens, choose LEFT_L_SHAPE or RIGHT_L_SHAPE when the customer specifies direction; use LEFT_L_SHAPE when they simply say L-shape without direction.
- When the customer wants an island, set layoutSensitiveCabinets.island.status = "YES" and requested = true. If they do not want one, set status = "NO" and requested = false. If unclear, set status = "UNKNOWN" and requested = false. Do not choose island-specific layoutPreference values.

Be concise and practical. After updating fields, briefly confirm what you changed and mention any important Confirmation Required items.`;

export type Round1AgentContext = {
  form: Round1FormInput;
  /** Set to the merged form whenever `update_intake` succeeds; otherwise null. */
  updatedForm: Round1FormInput | null;
};

export function createRound1AgentContext(
  form: Round1FormInput
): Round1AgentContext {
  return { form, updatedForm: null };
}

/**
 * Executes one agent tool against the mutable context. This is the deterministic
 * core of the agent: every tool wraps an existing domain function. It never
 * throws for ordinary failures — it returns an `{ error }`-shaped object the
 * model can react to within the loop.
 */
export async function executeRound1AgentTool(
  name: string,
  args: unknown,
  ctx: Round1AgentContext
): Promise<unknown> {
  switch (name) {
    case "update_intake": {
      const rawPatch = isPlainObject(args) ? args : {};
      const patch = sanitizePatchForUpdateIntake(rawPatch);
      const merged = synchronizeOvenMicrowaveArrangement(
        deepMergeForm(ctx.form as unknown as Record<string, unknown>, patch),
        patch
      );
      // Zod both validates AND strips any field outside the form schema, so the
      // agent cannot introduce snapshot/readiness/control fields even if it tries.
      const parsed = round1FormSchema.safeParse(merged);
      if (!parsed.success) {
        return {
          ok: false,
          error: "The requested change is not valid for the intake form.",
          issues: parsed.error.issues.slice(0, 8).map((issue) => ({
            path: issue.path.join("."),
            message: issue.message
          }))
        };
      }
      ctx.form = parsed.data;
      ctx.updatedForm = parsed.data;
      const { confirmationItems } = normalizeRound1Form(parsed.data);
      return {
        ok: true,
        confirmationItemCount: confirmationItems.length,
        confirmations: confirmationItems.map((item) => ({
          code: item.code,
          message: item.message
        })),
        note: "Applied to the live form. Not production data; rough sales estimate only."
      };
    }
    case "estimate_cabinets": {
      const estimate = generatePreliminaryCabinetList(
        createDefaultCabinetRuns(ctx.form)
      );
      const summary = summarizePreliminaryCabinetEstimate(estimate);
      return {
        ...summary,
        note: "Rough sales estimate only, not for production."
      };
    }
    case "explain_confirmations": {
      const { confirmationItems } = normalizeRound1Form(ctx.form);
      return {
        count: confirmationItems.length,
        confirmationItems: confirmationItems.map((item) => ({
          category: item.category,
          code: item.code,
          message: item.message
        }))
      };
    }
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

export type RunRound1AgentTurnInput = {
  message: string;
  form: Round1FormInput;
  history?: ChatMessage[];
};

export type RunRound1AgentTurnResult = {
  reply: string;
  updatedForm?: Round1FormInput;
  toolCallsMade: string[];
};

/**
 * Runs one conversational turn of the Round 1 intake agent. Returns the
 * assistant reply and, if the agent changed any field, the validated updated
 * form for the client to apply via its existing `updateForm` path (which clears
 * the snapshot and forces regeneration — staleness rules stay intact).
 *
 * `deps.provider` is injectable for tests; production resolves it from env.
 */
export async function runRound1AgentTurn(
  input: RunRound1AgentTurnInput,
  deps: { provider?: LLMProvider } = {}
): Promise<RunRound1AgentTurnResult> {
  const provider = deps.provider ?? getLLMProvider();
  const ctx = createRound1AgentContext(input.form);

  const output = await provider.runAgentLoop(
    {
      systemPrompt: ROUND1_AGENT_SYSTEM_PROMPT,
      history: input.history ?? [],
      userMessage: input.message,
      tools: ROUND1_AGENT_TOOLS
    },
    (name, args) => executeRound1AgentTool(name, args, ctx)
  );

  return {
    reply: output.reply,
    updatedForm: ctx.updatedForm ?? undefined,
    toolCallsMade: output.toolCallsMade
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function sanitizePatchForUpdateIntake(
  patch: Record<string, unknown>
): Record<string, unknown> {
  return sanitizePatchBySchema(patch, UPDATE_INTAKE_PARAMETERS);
}

function sanitizePatchBySchema(
  patch: Record<string, unknown>,
  schema: unknown
): Record<string, unknown> {
  if (!isPlainObject(schema) || !isPlainObject(schema.properties)) {
    return {};
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, patchValue] of Object.entries(patch)) {
    const childSchema = schema.properties[key];
    if (!isPlainObject(childSchema)) {
      continue;
    }

    if (isPlainObject(patchValue) && isPlainObject(childSchema.properties)) {
      const childPatch = sanitizePatchBySchema(patchValue, childSchema);
      if (Object.keys(childPatch).length > 0) {
        sanitized[key] = childPatch;
      }
      continue;
    }

    sanitized[key] = patchValue;
  }

  return sanitized;
}

function getPatchOvenMicrowaveConfiguration(
  patch: Record<string, unknown>
): string | null {
  const layoutSensitivePatch = patch.layoutSensitiveCabinets;
  if (!isPlainObject(layoutSensitivePatch)) {
    return null;
  }

  const ovenMicrowavePatch = layoutSensitivePatch.ovenMicrowave;
  if (!isPlainObject(ovenMicrowavePatch)) {
    return null;
  }

  const configuration = ovenMicrowavePatch.configuration;
  return typeof configuration === "string" ? configuration : null;
}

function synchronizeOvenMicrowaveArrangement(
  merged: Record<string, unknown>,
  patch: Record<string, unknown>
): Record<string, unknown> {
  const configuration = getPatchOvenMicrowaveConfiguration(patch);
  if (configuration === null) {
    return merged;
  }

  const layoutSensitive = isPlainObject(merged.layoutSensitiveCabinets)
    ? { ...merged.layoutSensitiveCabinets }
    : {};
  const ovenMicrowave = isPlainObject(layoutSensitive.ovenMicrowave)
    ? { ...layoutSensitive.ovenMicrowave }
    : {};
  const cookingAppliances = isPlainObject(layoutSensitive.cookingAppliances)
    ? { ...layoutSensitive.cookingAppliances }
    : {};

  switch (configuration) {
    case "RANGE_INCLUDES_OVEN":
      cookingAppliances.wallOven = {
        status: "NO",
        relation: "NOT_APPLICABLE"
      };
      cookingAppliances.microwaveOvenCombo = {
        status: "UNKNOWN",
        relation: "UNKNOWN"
      };
      break;
    case "WALL_OVEN_MICROWAVE_STACK":
    case "SEPARATE_WALL_OVEN_AND_MICROWAVE":
      cookingAppliances.wallOven = { status: "YES", relation: "UNKNOWN" };
      cookingAppliances.microwaveOvenCombo = {
        status: "YES",
        relation: "UNKNOWN"
      };
      break;
    case "MICROWAVE_DRAWER":
    case "UPPER_CABINET_MICROWAVE":
    case "COUNTERTOP_MICROWAVE":
      cookingAppliances.wallOven = {
        status: "UNKNOWN",
        relation: "UNKNOWN"
      };
      cookingAppliances.microwaveOvenCombo = {
        status: "YES",
        relation: "UNKNOWN"
      };
      break;
    case "NO_MICROWAVE":
      cookingAppliances.wallOven = { status: "YES", relation: "UNKNOWN" };
      cookingAppliances.microwaveOvenCombo = {
        status: "NO",
        relation: "NOT_APPLICABLE"
      };
      break;
    case "NO_OVEN":
      cookingAppliances.wallOven = {
        status: "NO",
        relation: "NOT_APPLICABLE"
      };
      cookingAppliances.microwaveOvenCombo = {
        status: "YES",
        relation: "UNKNOWN"
      };
      break;
    case "UNKNOWN":
      ovenMicrowave.relation = "UNKNOWN";
      break;
    default:
      return merged;
  }

  ovenMicrowave.relation = "UNKNOWN";

  return {
    ...merged,
    layoutSensitiveCabinets: {
      ...layoutSensitive,
      ovenMicrowave,
      cookingAppliances
    }
  };
}

/**
 * Recursively merges an agent patch into the current form. Nested plain objects
 * are merged key-by-key; everything else (including null and arrays) is replaced
 * by the patch value. The result is then validated by `round1FormSchema`, so
 * this only needs to produce a candidate object.
 */
function deepMergeForm(
  base: Record<string, unknown>,
  patch: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...base };
  for (const [key, patchValue] of Object.entries(patch)) {
    const baseValue = result[key];
    if (isPlainObject(baseValue) && isPlainObject(patchValue)) {
      result[key] = deepMergeForm(baseValue, patchValue);
    } else {
      result[key] = patchValue;
    }
  }
  return result;
}
