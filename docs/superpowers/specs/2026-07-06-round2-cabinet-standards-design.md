# Round 2 Cabinet Standards Design

Date: 2026-07-06

## Goal

Create one validated, version-controlled source of truth for the cabinet dimensions and rules used by Round 2 autofill and constrained proposal adjustments.

## Scope

Phase 6 introduces `src/features/round2/model/cabinet-standards.ts` and migrates the existing Round 2 model consumers to it. It does not add database persistence, brand-specific standards, an administration UI, design-intent collection, or the Phase 8 solver rules.

The table contains layout-level nominal dimensions only. Millimetre panel and cut-list dimensions belong to a future manufacturing/BOM catalog and must not be mixed into the autofill configuration.

## Source Material

The nominal dimensions are calibrated against:

- `柜子尺寸数据整理.docx` — authoritative confirmed data; supersedes conflicts in the earlier source files.
- `欧柜地柜尺寸参数表(2).pdf`
- `欧柜吊柜尺寸参数表(1).pdf`
- `转角柜板件尺寸(2).xlsx`

The PDFs and workbook remain manufacturing references. Panel-level rows were inspected for context but are outside this model's scope.

## Architecture

The module exports one nested `CABINET_STANDARDS` object. Its shape is defined by an exported Zod schema, and its TypeScript type is inferred from that schema. The object is parsed when the module loads so invalid checked-in configuration fails immediately in development, tests, and builds.

The object contains:

- Base cabinet widths: 9, 12, 15, 18, 21, 24, 27, 30, 33, and 36 inches.
- Base cabinet height: 34 1/2 inches; countertop thickness: 1 1/2 inches; finished countertop height: 36 inches.
- Door rule: one door through 21 inches and two doors from 24 inches.
- No drawer-stack face-height combinations are defined yet. The supplied base-cabinet PDF lists drawer-box panel dimensions, not finished front-stack proportions, so the previous assumed combinations are removed.
- Standard upper cabinet heights: 30, 36, 40, and 42 inches.
- Hood upper cabinet heights: 12, 15, 18, 21, and 24 inches.
- Refrigerator upper cabinet heights: 12, 15, 18, 21, and 24 inches.
- Vertical standards: 18-inch minimum clearance from countertop to upper-cabinet bottom, and a flat-moulding range of 2–3 inches with 3 inches preferred.
- Filler standards: 3/4-inch minimum, 3-inch preferred width, and common widths of 3, 4, 5, and 6 inches.
- Corner standards: lazy Susan width options of 33 and 36 inches; blind-base width options of 39, 42, and 45 inches with a 3-inch adjacent-wall pull. Both base corner families are 34 1/2 inches high and 24 inches deep.
- Customer-provided appliance definitions: 24-inch dishwasher; 30/33-inch range, defaulting to 30; 30/33/36/39-inch sink base, defaulting to 36; and 36-inch refrigerator.
- Depths: 24-inch base, 12-inch standard upper, 24-inch refrigerator upper, and 24-inch tall cabinets.

All stored dimensions use integer sixteenths of an inch. The standard object is deeply readonly to prevent runtime mutation.

## Consumer Migration

`autofill.ts` reads cabinet widths, filler minimum, and explicit appliance defaults from `CABINET_STANDARDS`. `adjustments.ts` reads the same cabinet-width and filler standards. Existing exported constants may remain temporarily as derived compatibility aliases, but they must reference `CABINET_STANDARDS`; they may not contain independent numeric lists or values.

`STEP_CABINET_WIDTH` and `SET_SEGMENT_KIND` already route through adjustment helpers. Migrating those helpers therefore gives autofill and proposal editing the same width source without adding actions or changing reducer behavior.

Every Round 1 appliance symbol must be handled deliberately:

- `sink`, `range`, `fridge`, and `dishwasher` use their explicit standard option sets and defaults until the customer-provided value is carried into Round 2.
- `hood` does not reserve base-cabinet width; a hood upper aligns to the selected range in the Phase 8 solver.
- `oven` and `microwave` have no confirmed widths in the authoritative data. They must never use a guessed fallback. Until a customer-provided width reaches Round 2, autofill emits a blocking `Appliance width required` decision and does not treat the appliance as a valid reservation.

## Validation and Errors

The Zod schema requires positive integer dimensions, ascending unique width/height options, a valid non-overlapping door breakpoint, base cabinet height plus countertop thickness equal to finished countertop height, a flat-moulding minimum no greater than its preferred value or maximum, and appliance defaults contained in their option sets. Invalid configuration throws during module initialization. No runtime fallback is provided because an invalid checked-in standard table is a programming/configuration error.

## Testing

Development follows red-green-refactor:

1. Change the standards tests to assert the authoritative DOCX values; observe the expected failures.
2. Change the schema and checked-in table to match the confirmed nominal-dimension model.
3. Add autofill tests for explicit range options/default and removal of the unknown-appliance fallback.
4. Update autofill to ignore hood base reservations and produce blocking decisions for oven/microwave without confirmed widths.
5. Run the focused tests, full test suite, TypeScript check, and production build.

## Acceptance Criteria

- `CABINET_STANDARDS` is the sole maintained source for all Phase 6 values.
- Its Zod schema validates the checked-in object and is directly testable.
- Autofill and constrained adjustments consume the shared table.
- Existing autofill, adjustment, state, and drawing behavior does not regress.
- Round 2 model code contains no independently maintained duplicate cabinet-width, filler, or appliance-width standard.
- Standard upper heights are 30/36/40/42 inches, with separate hood and refrigerator-upper height options.
- Flat moulding is represented as a validated 2–3-inch range, preferred at 3 inches.
- Base cabinet, countertop thickness, and finished countertop height are represented without conflating their meanings.
- Filler minimum is 3/4 inch and common widths are represented.
- Lazy Susan and blind-base width option sets match the authoritative DOCX.
- Appliance option sets match the authoritative DOCX and are marked customer-provided.
- No unknown-appliance width fallback remains.
- Unsupported drawer-front assumptions and manufacturing cut-list dimensions are absent.
- `npm test`, `npx tsc --noEmit`, and `npm run build` succeed.
