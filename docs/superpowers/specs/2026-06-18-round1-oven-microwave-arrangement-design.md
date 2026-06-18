# Round 1 Oven And Microwave Arrangement Design

## Context

Round 1 intake should stay coarse and sales-estimate-only. The customer-facing
layout already supports automatic appliance placement and manual SVG dragging,
so asking for a separate "Wall oven approximate wall" is more detailed than this
step needs. The missing useful question is not wall position; it is whether a
wall oven and microwave should be treated as one stacked tall appliance cabinet
or as separate appliances.

## Goals

- Remove the "Wall oven approximate wall" question from the first-phase intake.
- Ask an oven/microwave relationship question when oven or microwave data is
  relevant.
- Preserve deterministic layout behavior: auto-layout chooses rough placement,
  and drag overrides remain authoritative when present.
- Improve the frozen JSON and customer rendering prompt so the image model gets
  precise appliance semantics.
- Keep the output clearly Round 1: rough, customer-confirmation level, not
  production-ready.

## Non-Goals

- Do not add production cabinet scheduling or exact tall cabinet dimensions.
- Do not require the user to choose a precise wall in the form.
- Do not make AI-generated renderings authoritative for layout, cabinet counts,
  or geometry.

## User Experience

In the Core Appliances step:

- `Wall oven included?` remains a `YES / NO / UNKNOWN` question.
- When `Wall oven included?` is `YES`, no wall selector appears.
- `Microwave / oven combo included?` remains a `YES / NO / UNKNOWN` question.
- When either wall oven or microwave/combo is `YES`, show:
  `Oven and microwave arrangement?`

Arrangement options:

- `STACKED_TOGETHER`: wall oven and microwave are in one tall stacked appliance
  cabinet.
- `SEPARATE`: wall oven and microwave are separate appliance locations.
- `MICROWAVE_ONLY`: microwave is present; no separate wall oven.
- `OVEN_ONLY`: wall oven is present; no microwave.
- `UNKNOWN`: relationship is not confirmed.

The label can be user-friendly, but the saved value should be stable and
machine-readable.

## Data Model

Continue storing rough appliance presence in:

```ts
layoutSensitiveCabinets.cookingAppliances = {
  range,
  cooktop,
  wallOven,
  microwaveOvenCombo
}
```

Use `layoutSensitiveCabinets.ovenMicrowave.configuration` as the arrangement
source of truth for oven/microwave relationship:

```ts
type OvenMicrowaveConfiguration =
  | "RANGE_INCLUDES_OVEN"
  | "WALL_OVEN_MICROWAVE_STACK"
  | "SEPARATE_WALL_OVEN_AND_MICROWAVE"
  | "MICROWAVE_DRAWER"
  | "UPPER_CABINET_MICROWAVE"
  | "COUNTERTOP_MICROWAVE"
  | "NO_MICROWAVE"
  | "NO_OVEN"
  | "UNKNOWN";
```

Mapping from the new UI question:

- `STACKED_TOGETHER` -> `WALL_OVEN_MICROWAVE_STACK`
- `SEPARATE` -> `SEPARATE_WALL_OVEN_AND_MICROWAVE`
- `MICROWAVE_ONLY` -> microwave status `YES`, wall oven status `NO`,
  configuration stays microwave-specific if known, otherwise `UNKNOWN`
- `OVEN_ONLY` -> wall oven status `YES`, microwave status `NO`,
  configuration `NO_MICROWAVE`
- `UNKNOWN` -> configuration `UNKNOWN`

`relation` for wall oven and microwave should remain `UNKNOWN` unless a drag
override or external agent update provides a more specific value. This keeps
form answers separate from spatial adjustment.

## Layout Behavior

The deterministic floor plan remains authoritative.

- For `WALL_OVEN_MICROWAVE_STACK`, render a single tall stacked appliance
  symbol instead of two separate tall symbols.
- For `SEPARATE_WALL_OVEN_AND_MICROWAVE`, render separate wall oven and
  microwave/combo symbols and let auto-layout distribute them across available
  layout walls.
- Drag overrides continue to win over auto-layout.
- If older snapshots use only the existing `cookingAppliances` fields, preserve
  backward compatibility by falling back to current behavior.

## Rendering Prompt Behavior

The prompt should derive appliance semantics from the frozen snapshot:

- `WALL_OVEN_MICROWAVE_STACK`: describe a stacked wall oven and microwave tower
  in one tall appliance cabinet.
- `SEPARATE_WALL_OVEN_AND_MICROWAVE`: describe a wall oven and a separate
  microwave location.
- `NO_MICROWAVE`: explicitly prohibit drawing a microwave.
- `NO_OVEN`: explicitly prohibit drawing a separate wall oven.

Spatial wording should continue to come from the deterministic floor plan, not
from unconfirmed form wall relations.

## Agent Behavior

The Round 1 intake agent should understand the same distinction:

- If the customer says the microwave is above the wall oven, set
  `WALL_OVEN_MICROWAVE_STACK`.
- If the customer says they are separate, set
  `SEPARATE_WALL_OVEN_AND_MICROWAVE`.
- If unclear, leave the configuration `UNKNOWN` instead of guessing.

The agent must still preserve range/cooktop exclusivity.

## Testing

Add or update tests for:

- The appliance step no longer renders `Wall oven approximate wall`.
- The new arrangement question appears only when oven/microwave data is
  relevant.
- Normalization accepts the new `SEPARATE_WALL_OVEN_AND_MICROWAVE` value.
- Floor plan generation renders one stacked symbol for stacked configuration and
  separate symbols for separate configuration.
- Rendering prompt names stacked versus separate arrangements accurately.
- Existing saved data without the new value remains parseable.

## Risks

- There is existing UI/test language that assumes wall oven still asks for a
  wall. Those tests should be updated intentionally, not deleted blindly.
- The term `microwaveOvenCombo` currently represents both a microwave-related
  appliance and sometimes a combined tower. The implementation should keep
  backward compatibility while making prompt language clearer.
- If the form and floor plan disagree, the frozen floor plan remains the spatial
  authority for rendering.
