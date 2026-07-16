# Appliance-width tiered autofit

## Goal

At the Technical Design proposal stage, appliance widths must always be an
existing `APPLIANCE WIDTH` option. A wall overflow must never be resolved by
proportional scaling or any other arbitrary width.

## Scope

- Sink bases use their configured options: 30, 33, 36, and 39 inches.
- Ranges use their configured options: 30 and 33 inches.
- When a measured wall is overfull, autofill lowers appliance widths in this
  exact order: sink first, then range. Each reduction moves down exactly one
  configured option at a time.
- The process repeats until the base run fits, or no sink/range has a smaller
  option remaining.
- Refrigerators and dishwashers retain their configured width; they are not
  part of the automatic reduction sequence.
- Proposal editing exposes only the configured appliance-width chips. The
  arbitrary custom appliance-width field is removed, and state actions reject
  widths that are not configured for that appliance.

## Behavior

1. Build the normal base reservations from the fixed appliance points.
2. If their total fits the available base span, retain all configured widths.
3. If they overflow, repeatedly step the first eligible sink down one option.
   Once every sink is at its smallest option, step eligible ranges down one
   option.
4. If the total then fits, lay out the selected standard widths and add a
   warning identifying the appliances adjusted to fit.
5. If the smallest permitted sink/range widths still overflow (or a measured
   opening prevents fitting), preserve the existing blocking overflow decision.

## UI and state boundaries

- The standards file remains the single source of truth for appliance options.
- The Proposal card renders only those options and has no custom appliance
  width input.
- `SET_APPLIANCE_WIDTH` validates the requested width against the applicable
  appliance standard before rebuilding the proposal. Invalid values are a
  no-op.

## Error handling

- Unknown appliance symbols, a wall with no available span, or an overflow
  with no eligible sink/range remain on the existing blocking path.
- Door/opening reservations never change width.

## Tests

- Autofill reduces sinks before ranges and produces only configured widths.
- A remaining overflow after the smallest eligible widths produces the
  existing blocking decision.
- State rejects a non-standard appliance width.
- Proposal rendering has width chips but no custom appliance-width field.
