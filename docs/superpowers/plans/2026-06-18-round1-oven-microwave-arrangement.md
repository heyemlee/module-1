# Round 1 Oven Microwave Arrangement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the wall oven wall-position question and add a first-phase oven/microwave arrangement model that improves deterministic layout and customer rendering semantics.

**Architecture:** Keep rough appliance presence in `cookingAppliances`, and use `layoutSensitiveCabinets.ovenMicrowave.configuration` as the relationship source of truth. The form collects presence plus arrangement, the floor-plan builder turns stacked arrangements into one deterministic appliance symbol, and the rendering prompt describes stacked versus separate appliances from the frozen snapshot.

**Tech Stack:** Next.js App Router, React, TypeScript, Zod, SVG floor-plan geometry, Vitest, existing Round 1 domain and rendering prompt modules.

---

## File Structure

- Modify `src/domain/round1/schemas.ts`
  - Add `SEPARATE_WALL_OVEN_AND_MICROWAVE` to the oven/microwave configuration enum.

- Modify `src/features/round1/showroom-intake-data.ts`
  - Keep defaults backward-compatible and leave oven/microwave arrangement unknown by default.

- Modify `src/features/round1/showroom-intake-steps.tsx`
  - Hide the wall oven approximate wall selector.
  - Add the conditional `Oven and microwave arrangement?` selector.
  - Keep wall oven and microwave relations as `UNKNOWN` unless an external update or drag override supplies a value.

- Modify `src/features/round1/showroom-intake-app.test.tsx`
  - Cover the removed wall question and conditional arrangement question.

- Modify `src/domain/round1/round1-core.test.ts`
  - Cover schema/normalization acceptance for `SEPARATE_WALL_OVEN_AND_MICROWAVE`.

- Modify `src/features/round1/floorplan/plan-geometry.ts`
  - Treat `WALL_OVEN_MICROWAVE_STACK` as one tall appliance symbol.
  - Keep `SEPARATE_WALL_OVEN_AND_MICROWAVE` as two separate appliance symbols.
  - Preserve drag override precedence.

- Modify `src/features/round1/floorplan/plan-geometry.test.ts`
  - Cover stacked-one-symbol and separate-two-symbol behavior.

- Modify `src/features/round1/floorplan/spatial-language.ts`
  - Give the stacked appliance a distinct noun for rendering prompt wall walkthroughs.

- Modify `src/features/round1/rendering-prompt.ts`
  - Add prompt wording for stacked versus separate arrangements.
  - Avoid duplicate/conflicting cooking appliance wording when configuration is explicit.

- Modify `src/features/round1/rendering-prompt.test.ts`
  - Cover prompt text for stacked and separate arrangements.

- Modify `src/server/round1/agent-service.ts`
  - Add the new enum value to the agent tool schema.
  - Teach the system prompt how to map "microwave above wall oven" and "separate" statements.

- Modify `src/server/round1/agent-service.test.ts`
  - Cover agent tool updates accepting the new configuration.

---

### Task 1: Schema Accepts Separate Oven/Microwave Arrangement

**Files:**
- Modify: `src/domain/round1/schemas.ts:185-197`
- Modify: `src/domain/round1/round1-core.test.ts`

- [ ] **Step 1: Write the failing schema/normalization test**

Add this test in `src/domain/round1/round1-core.test.ts` near the existing normalization tests:

```ts
test("normalizes a separate wall oven and microwave arrangement", () => {
  const form = {
    ...createValidRound1Form(),
    layoutSensitiveCabinets: {
      ...createValidRound1Form().layoutSensitiveCabinets,
      ovenMicrowave: {
        configuration: "SEPARATE_WALL_OVEN_AND_MICROWAVE" as const,
        relation: "UNKNOWN" as const
      },
      cookingAppliances: {
        range: { status: "NO" as const, relation: "NOT_APPLICABLE" as const },
        cooktop: { status: "YES" as const, relation: "UNKNOWN" as const },
        wallOven: { status: "YES" as const, relation: "UNKNOWN" as const },
        microwaveOvenCombo: {
          status: "YES" as const,
          relation: "UNKNOWN" as const
        }
      }
    }
  };

  const result = normalizeRound1Form(form);

  expect(
    result.normalized.layoutSensitiveCabinets.ovenMicrowave
  ).toMatchObject({
    configuration: "SEPARATE_WALL_OVEN_AND_MICROWAVE",
    relation: "UNKNOWN"
  });
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
npm test -- src/domain/round1/round1-core.test.ts
```

Expected: FAIL with a Zod enum validation error because `SEPARATE_WALL_OVEN_AND_MICROWAVE` is not accepted yet.

- [ ] **Step 3: Add the enum value**

In `src/domain/round1/schemas.ts`, update the `ovenMicrowave.configuration` enum:

```ts
configuration: z.enum([
  "RANGE_INCLUDES_OVEN",
  "WALL_OVEN_MICROWAVE_STACK",
  "SEPARATE_WALL_OVEN_AND_MICROWAVE",
  "MICROWAVE_DRAWER",
  "UPPER_CABINET_MICROWAVE",
  "COUNTERTOP_MICROWAVE",
  "NO_MICROWAVE",
  "NO_OVEN",
  "UNKNOWN"
])
```

- [ ] **Step 4: Run the test and verify it passes**

Run:

```bash
npm test -- src/domain/round1/round1-core.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/domain/round1/schemas.ts src/domain/round1/round1-core.test.ts
git commit -m "feat(round1): accept separate oven microwave arrangement"
```

---

### Task 2: Appliance Form Removes Wall Oven Wall Question And Adds Arrangement Question

**Files:**
- Modify: `src/features/round1/showroom-intake-steps.tsx:328-540`
- Modify: `src/features/round1/showroom-intake-app.test.tsx`

- [ ] **Step 1: Write the failing UI tests**

In `src/features/round1/showroom-intake-app.test.tsx`, update the existing appliance tests as follows.

Replace the assertion that wall oven still asks for a wall with:

```ts
expect(html).not.toContain("Wall oven approximate wall");
```

Add this test to the `describe("AppliancesStep", ...)` block:

```tsx
test("shows oven and microwave arrangement only when oven or microwave is present", () => {
  const base = createDefaultShowroomForm();
  const hiddenHtml = renderToStaticMarkup(
    <AppliancesStep
      form={{
        ...base,
        layoutSensitiveCabinets: {
          ...base.layoutSensitiveCabinets,
          cookingAppliances: {
            ...base.layoutSensitiveCabinets.cookingAppliances,
            wallOven: { status: "NO", relation: "NOT_APPLICABLE" },
            microwaveOvenCombo: { status: "NO", relation: "NOT_APPLICABLE" }
          }
        }
      }}
      setForm={() => {}}
    />
  );
  expect(hiddenHtml).not.toContain("Oven and microwave arrangement?");

  const visibleHtml = renderToStaticMarkup(
    <AppliancesStep
      form={{
        ...base,
        layoutSensitiveCabinets: {
          ...base.layoutSensitiveCabinets,
          cookingAppliances: {
            ...base.layoutSensitiveCabinets.cookingAppliances,
            wallOven: { status: "YES", relation: "UNKNOWN" },
            microwaveOvenCombo: { status: "YES", relation: "UNKNOWN" }
          }
        }
      }}
      setForm={() => {}}
    />
  );

  expect(visibleHtml).toContain("Oven and microwave arrangement?");
  expect(visibleHtml).toContain("WALL_OVEN_MICROWAVE_STACK");
  expect(visibleHtml).toContain("SEPARATE_WALL_OVEN_AND_MICROWAVE");
  expect(visibleHtml).toContain("NO_MICROWAVE");
  expect(visibleHtml).toContain("NO_OVEN");
  expect(visibleHtml).toContain("UNKNOWN");
});
```

- [ ] **Step 2: Run the focused UI tests and verify they fail**

Run:

```bash
npm test -- src/features/round1/showroom-intake-app.test.tsx
```

Expected: FAIL because `Wall oven approximate wall` still renders and the new arrangement selector does not exist.

- [ ] **Step 3: Hide wall selection for wall oven**

In `src/features/round1/showroom-intake-steps.tsx`, change the `Wall oven` field:

```tsx
<RoughApplianceFields
  label="Wall oven"
  value={cooking.wallOven}
  showWall={false}
  onStatusChange={(status) => setCookingStatus("wallOven", status)}
  onRelationChange={(relation) =>
    setCookingAppliance("wallOven", { relation })
  }
/>
```

- [ ] **Step 4: Add arrangement options and setter**

Near the other option arrays in `src/features/round1/showroom-intake-steps.tsx`, add:

```ts
const ovenMicrowaveConfigurationOptions = [
  "WALL_OVEN_MICROWAVE_STACK",
  "SEPARATE_WALL_OVEN_AND_MICROWAVE",
  "NO_MICROWAVE",
  "NO_OVEN",
  "UNKNOWN"
] as const;
```

Inside `AppliancesStep`, after `setCookingStatus`, add:

```ts
const setOvenMicrowaveConfiguration = (
  configuration: Round1FormInput["layoutSensitiveCabinets"]["ovenMicrowave"]["configuration"]
) => {
  const nextCooking = { ...cooking };
  if (configuration === "WALL_OVEN_MICROWAVE_STACK") {
    nextCooking.wallOven = { status: "YES", relation: "UNKNOWN" };
    nextCooking.microwaveOvenCombo = { status: "YES", relation: "UNKNOWN" };
  }
  if (configuration === "SEPARATE_WALL_OVEN_AND_MICROWAVE") {
    nextCooking.wallOven = { status: "YES", relation: "UNKNOWN" };
    nextCooking.microwaveOvenCombo = { status: "YES", relation: "UNKNOWN" };
  }
  if (configuration === "NO_MICROWAVE") {
    nextCooking.wallOven = { status: "YES", relation: "UNKNOWN" };
    nextCooking.microwaveOvenCombo = {
      status: "NO",
      relation: "NOT_APPLICABLE"
    };
  }
  if (configuration === "NO_OVEN") {
    nextCooking.wallOven = { status: "NO", relation: "NOT_APPLICABLE" };
    nextCooking.microwaveOvenCombo = { status: "YES", relation: "UNKNOWN" };
  }

  setForm({
    ...form,
    layoutSensitiveCabinets: {
      ...form.layoutSensitiveCabinets,
      ovenMicrowave: {
        ...form.layoutSensitiveCabinets.ovenMicrowave,
        configuration,
        relation: "UNKNOWN"
      },
      cookingAppliances: nextCooking
    }
  });
};
```

- [ ] **Step 5: Render the conditional selector**

Inside the appliance grid after the `Microwave / oven combo` fields, add:

```tsx
{(cooking.wallOven.status === "YES" ||
  cooking.microwaveOvenCombo.status === "YES") && (
  <SelectField
    label="Oven and microwave arrangement?"
    value={form.layoutSensitiveCabinets.ovenMicrowave.configuration}
    options={ovenMicrowaveConfigurationOptions}
    onChange={setOvenMicrowaveConfiguration}
  />
)}
```

- [ ] **Step 6: Run the UI tests and verify they pass**

Run:

```bash
npm test -- src/features/round1/showroom-intake-app.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```bash
git add src/features/round1/showroom-intake-steps.tsx src/features/round1/showroom-intake-app.test.tsx
git commit -m "feat(round1): collect oven microwave arrangement"
```

---

### Task 3: Floor Plan Uses One Symbol For Stacked Arrangement

**Files:**
- Modify: `src/features/round1/floorplan/plan-geometry.ts:73-85`
- Modify: `src/features/round1/floorplan/plan-geometry.ts:803-997`
- Modify: `src/features/round1/floorplan/plan-geometry.test.ts`

- [ ] **Step 1: Write the failing geometry tests**

Add these tests to `src/features/round1/floorplan/plan-geometry.test.ts` near the existing oven/microwave auto-layout tests:

```ts
test("renders one appliance symbol for stacked wall oven and microwave", () => {
  const base = formForLayout("L_SHAPE");
  const form: Round1FormInput = {
    ...base,
    layoutSensitiveCabinets: {
      ...base.layoutSensitiveCabinets,
      ovenMicrowave: {
        configuration: "WALL_OVEN_MICROWAVE_STACK",
        relation: "UNKNOWN"
      },
      cookingAppliances: {
        range: { status: "YES", relation: "BACK_SIDE" },
        cooktop: { status: "NO", relation: "NOT_APPLICABLE" },
        wallOven: { status: "YES", relation: "UNKNOWN" },
        microwaveOvenCombo: { status: "YES", relation: "UNKNOWN" }
      }
    }
  };

  const { plan } = planFromForm(form);
  const ovenKeys = plan.appliances
    .filter((item) => item.symbol === "oven")
    .map((item) => item.key);

  expect(ovenKeys).toEqual(["ovenMicrowaveStack"]);
});

test("renders separate symbols for separate wall oven and microwave", () => {
  const base = formForLayout("L_SHAPE");
  const form: Round1FormInput = {
    ...base,
    layoutSensitiveCabinets: {
      ...base.layoutSensitiveCabinets,
      ovenMicrowave: {
        configuration: "SEPARATE_WALL_OVEN_AND_MICROWAVE",
        relation: "UNKNOWN"
      },
      cookingAppliances: {
        range: { status: "YES", relation: "BACK_SIDE" },
        cooktop: { status: "NO", relation: "NOT_APPLICABLE" },
        wallOven: { status: "YES", relation: "UNKNOWN" },
        microwaveOvenCombo: { status: "YES", relation: "UNKNOWN" }
      }
    }
  };

  const { plan } = planFromForm(form);
  const ovenKeys = plan.appliances
    .filter((item) => item.symbol === "oven")
    .map((item) => item.key);

  expect(ovenKeys).toContain("wallOven");
  expect(ovenKeys).toContain("microwaveOvenCombo");
});
```

- [ ] **Step 2: Run geometry tests and verify they fail**

Run:

```bash
npm test -- src/features/round1/floorplan/plan-geometry.test.ts
```

Expected: FAIL because stacked configuration still creates separate `wallOven` and `microwaveOvenCombo` symbols.

- [ ] **Step 3: Add the stacked key to layout-sensitive typing**

In `src/features/round1/floorplan/plan-geometry.ts`, leave `ApplianceSymbol` as-is and keep `oven` as the drawing symbol. No new symbol is required. Use the key `ovenMicrowaveStack` for semantics.

Update `LayoutSensitive` if needed so `ovenMicrowave.configuration` is read safely:

```ts
type LayoutSensitive = {
  ovenMicrowave?: { configuration?: string; relation?: string };
  cookingAppliances?: {
    range?: { status?: string; relation?: string };
    cooktop?: { status?: string; relation?: string };
    wallOven?: { status?: string; relation?: string };
    microwaveOvenCombo?: { status?: string; relation?: string };
  };
  island?: { requested?: boolean };
};
```

- [ ] **Step 4: Implement stacked placement logic**

Inside `placeAppliances`, after computing `microwavePresent`, add:

```ts
const ovenMicrowaveConfiguration =
  layoutSensitive.ovenMicrowave?.configuration ?? "UNKNOWN";
const stackedOvenMicrowave =
  ovenMicrowaveConfiguration === "WALL_OVEN_MICROWAVE_STACK" &&
  wallOvenPresent &&
  microwavePresent;
```

Change load and wall selection so stacked uses one wall:

```ts
const stackWall = stackedOvenMicrowave
  ? resolveApplianceWall(
      ctx.overrides,
      "ovenMicrowaveStack",
      layoutSensitive.ovenMicrowave?.relation,
      layoutPreference
    ) ?? wallOvenWall ?? microwaveWall
  : undefined;
```

When adding load, replace the separate wall oven/microwave loads with:

```ts
if (stackedOvenMicrowave) {
  addLoad(stackWall, 30);
} else {
  addLoad(wallOvenWall, 30);
  addLoad(microwaveWall, 30);
}
```

Before the separate wall oven final-wall block, add:

```ts
let stackFinalWall: Wall | undefined;
if (stackedOvenMicrowave) {
  stackFinalWall = stackWall ?? pickAutoWall(false);
  if (!stackWall) addLoad(stackFinalWall, 30);
}
```

Guard the existing wall oven and microwave final-wall blocks:

```ts
if (wallOvenPresent && !stackedOvenMicrowave) {
  wallOvenFinalWall = wallOvenWall ?? pickAutoWall(false);
  if (!wallOvenWall) addLoad(wallOvenFinalWall, 30);
}

if (microwavePresent && !stackedOvenMicrowave) {
  microwaveFinalWall = microwaveWall ?? pickAutoWall(false);
  if (!microwaveWall) addLoad(microwaveFinalWall, 30);
}
```

Before pushing separate wall oven/microwave specs, push the stack spec:

```ts
if (stackedOvenMicrowave && stackFinalWall) {
  specs.push({
    key: "ovenMicrowaveStack",
    label: "Wall oven + microwave stack",
    symbol: "oven",
    sizeIn: 30,
    wall: stackFinalWall,
    deep: true
  });
}
```

Then guard the existing wall oven and microwave pushes with `!stackedOvenMicrowave`.

- [ ] **Step 5: Run geometry tests and verify they pass**

Run:

```bash
npm test -- src/features/round1/floorplan/plan-geometry.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add src/features/round1/floorplan/plan-geometry.ts src/features/round1/floorplan/plan-geometry.test.ts
git commit -m "feat(round1): render stacked oven microwave as one symbol"
```

---

### Task 4: Rendering Prompt Describes Stacked Versus Separate Arrangements

**Files:**
- Modify: `src/features/round1/floorplan/spatial-language.ts:22-42`
- Modify: `src/features/round1/rendering-prompt.ts:41-181`
- Modify: `src/features/round1/rendering-prompt.test.ts`

- [ ] **Step 1: Write failing prompt tests**

Add these tests to `src/features/round1/rendering-prompt.test.ts`:

```ts
test("describes a stacked wall oven and microwave tower", () => {
  const snapshot = buildSnapshot();
  snapshot.showroomForm.layoutSensitiveCabinets.ovenMicrowave = {
    configuration: "WALL_OVEN_MICROWAVE_STACK",
    relation: "UNKNOWN"
  };
  snapshot.showroomForm.layoutSensitiveCabinets.cookingAppliances = {
    range: { status: "YES", relation: "BACK_SIDE" },
    cooktop: { status: "NO", relation: "NOT_APPLICABLE" },
    wallOven: { status: "YES", relation: "UNKNOWN" },
    microwaveOvenCombo: { status: "YES", relation: "UNKNOWN" }
  };

  const prompt = buildRound1RenderingPrompt(snapshot);

  expect(prompt).toContain(
    "stacked wall oven and microwave tower in one tall appliance cabinet"
  );
  expect(prompt).not.toContain("wall oven on an unconfirmed wall");
  expect(prompt).not.toContain("microwave / oven combo on an unconfirmed wall");
});

test("describes separate wall oven and microwave locations", () => {
  const snapshot = buildSnapshot();
  snapshot.showroomForm.layoutSensitiveCabinets.ovenMicrowave = {
    configuration: "SEPARATE_WALL_OVEN_AND_MICROWAVE",
    relation: "UNKNOWN"
  };
  snapshot.showroomForm.layoutSensitiveCabinets.cookingAppliances = {
    range: { status: "YES", relation: "BACK_SIDE" },
    cooktop: { status: "NO", relation: "NOT_APPLICABLE" },
    wallOven: { status: "YES", relation: "UNKNOWN" },
    microwaveOvenCombo: { status: "YES", relation: "UNKNOWN" }
  };

  const prompt = buildRound1RenderingPrompt(snapshot);

  expect(prompt).toContain(
    "a wall oven and a separate microwave location"
  );
});
```

- [ ] **Step 2: Run prompt tests and verify they fail**

Run:

```bash
npm test -- src/features/round1/rendering-prompt.test.ts
```

Expected: FAIL because the new separate phrase does not exist and stacked wording is not specific enough.

- [ ] **Step 3: Update appliance noun for the stacked key**

In `src/features/round1/floorplan/spatial-language.ts`, update `applianceNoun`:

```ts
if (appliance.key === "ovenMicrowaveStack") {
  return "a stacked wall oven and microwave tower";
}
```

- [ ] **Step 4: Update oven/microwave prompt phrases**

In `src/features/round1/rendering-prompt.ts`, update `OVEN_MICROWAVE_PHRASES`:

```ts
const OVEN_MICROWAVE_PHRASES: Record<string, string> = {
  RANGE_INCLUDES_OVEN: "the oven is built into the lower half of the freestanding range (the oven door must be clearly visible under the cooktop; DO NOT draw a separate wall oven)",
  WALL_OVEN_MICROWAVE_STACK: "a stacked wall oven and microwave tower in one tall appliance cabinet",
  SEPARATE_WALL_OVEN_AND_MICROWAVE: "a wall oven and a separate microwave location",
  MICROWAVE_DRAWER: "a microwave drawer",
  UPPER_CABINET_MICROWAVE: "a microwave in an upper cabinet",
  COUNTERTOP_MICROWAVE: "a countertop microwave",
  NO_MICROWAVE: "DO NOT draw a microwave",
  NO_OVEN: "DO NOT draw a separate wall oven",
  UNKNOWN: ""
};
```

- [ ] **Step 5: Avoid duplicate rough wording for explicit arrangement configurations**

In `buildRound1RenderingPrompt`, derive the configuration once:

```ts
const ovenMicrowaveConfiguration =
  showroomForm.layoutSensitiveCabinets?.ovenMicrowave?.configuration || "UNKNOWN";
const ovenPhrase = OVEN_MICROWAVE_PHRASES[ovenMicrowaveConfiguration];
```

Then only append rough cooking appliance details when configuration is not an explicit oven/microwave arrangement:

```ts
const shouldDescribeRoughCooking =
  ![
    "WALL_OVEN_MICROWAVE_STACK",
    "SEPARATE_WALL_OVEN_AND_MICROWAVE"
  ].includes(ovenMicrowaveConfiguration);

const cookingPhrase = shouldDescribeRoughCooking
  ? describeRoughCookingAppliances(
      showroomForm.layoutSensitiveCabinets?.cookingAppliances
    )
  : "";
```

- [ ] **Step 6: Run prompt tests and verify they pass**

Run:

```bash
npm test -- src/features/round1/rendering-prompt.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```bash
git add src/features/round1/floorplan/spatial-language.ts src/features/round1/rendering-prompt.ts src/features/round1/rendering-prompt.test.ts
git commit -m "feat(round1): describe oven microwave arrangement in rendering prompt"
```

---

### Task 5: Agent Tool Schema Accepts Arrangement

**Files:**
- Modify: `src/server/round1/agent-service.ts:120-214`
- Modify: `src/server/round1/agent-service.test.ts`

- [ ] **Step 1: Write the failing agent tool test**

Add this test to `src/server/round1/agent-service.test.ts`:

```ts
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
```

- [ ] **Step 2: Run agent tests and verify they fail**

Run:

```bash
npm test -- src/server/round1/agent-service.test.ts
```

Expected: FAIL because the agent tool schema enum does not include `SEPARATE_WALL_OVEN_AND_MICROWAVE`.

- [ ] **Step 3: Add the enum value to the tool schema**

In `src/server/round1/agent-service.ts`, update the `ovenMicrowave.configuration.enum` array:

```ts
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
```

- [ ] **Step 4: Update the agent system prompt**

In the `Cooking appliances:` section of `ROUND1_AGENT_SYSTEM_PROMPT`, add this bullet after the range/cooktop rule:

```text
- If the customer says the microwave is above the wall oven, stacked with the wall oven, or in the same tall appliance cabinet, set layoutSensitiveCabinets.ovenMicrowave.configuration = "WALL_OVEN_MICROWAVE_STACK" and set both wallOven and microwaveOvenCombo statuses to YES when you are confident. If the customer says the wall oven and microwave are separate, set configuration = "SEPARATE_WALL_OVEN_AND_MICROWAVE". If unclear, leave configuration = "UNKNOWN".
```

- [ ] **Step 5: Run agent tests and verify they pass**

Run:

```bash
npm test -- src/server/round1/agent-service.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add src/server/round1/agent-service.ts src/server/round1/agent-service.test.ts
git commit -m "feat(round1): teach agent oven microwave arrangement"
```

---

### Task 6: Full Verification

**Files:**
- No production files should be modified in this task unless verification reveals a real regression.

- [ ] **Step 1: Run all tests**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 2: Run TypeScript build**

Run:

```bash
npm run build
```

Expected: PASS. If `next lint` is unavailable or unsupported under this Next.js version, do not add a lint step here.

- [ ] **Step 3: Inspect git status**

Run:

```bash
git status --short
```

Expected: no unstaged or uncommitted files after the task commits, except intentionally generated local artifacts if any are documented in the final response.

---

## Self-Review

- Spec coverage:
  - Removing `Wall oven approximate wall` is covered by Task 2.
  - Adding the oven/microwave relationship question is covered by Task 2.
  - JSON/schema support for the new separate arrangement is covered by Task 1.
  - Stacked versus separate layout behavior is covered by Task 3.
  - Rendering prompt semantics are covered by Task 4.
  - Agent intake behavior is covered by Task 5.
  - Verification is covered by Task 6.
- Placeholder scan:
  - No unresolved placeholder language is intentionally present.
- Type consistency:
  - The saved schema value is `SEPARATE_WALL_OVEN_AND_MICROWAVE`.
  - The stacked floor-plan key is `ovenMicrowaveStack`.
  - The existing drawing symbol remains `oven`.
