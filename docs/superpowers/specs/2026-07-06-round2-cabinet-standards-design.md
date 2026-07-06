# Round 2 Cabinet Standards Design

Date: 2026-07-06

## Goal

Create one validated, version-controlled source of truth for the cabinet dimensions and rules used by Round 2 autofill and constrained proposal adjustments.

## Scope

Phase 6 introduces `src/features/round2/model/cabinet-standards.ts` and migrates the existing Round 2 model consumers to it. It does not add database persistence, brand-specific standards, an administration UI, design-intent collection, or the Phase 8 solver rules.

## Architecture

The module exports one nested `CABINET_STANDARDS` object. Its shape is defined by an exported Zod schema, and its TypeScript type is inferred from that schema. The object is parsed when the module loads so invalid checked-in configuration fails immediately in development, tests, and builds.

The object contains:

- Base cabinet widths: 9, 12, 15, 18, 21, 24, 27, 30, 33, and 36 inches.
- Door rule: one door through 21 inches and two doors from 24 inches.
- Standard drawer-stack height combinations: 6/12/12 inches and 6/6/9/9 inches.
- Upper cabinet heights: 30, 36, and 42 inches.
- Vertical standards: 34 1/2-inch counter height, 18-inch minimum backsplash, and a 3-inch flat-moulding allowance.
- Filler standards: 1/2-inch minimum and 3-inch preferred width.
- Corner standards: 36-by-36-inch lazy Susan; 39-inch minimum blind-base width and a 3-inch adjacent-wall pull.
- Appliance definitions: 24-inch dishwasher, 30-inch range, 30/33/36-inch sink base, and 36-inch refrigerator, together with their display labels.
- Depths: 24-inch base, 12-inch upper, and 24-inch tall cabinets.

All stored dimensions use integer sixteenths of an inch. The standard object is deeply readonly to prevent runtime mutation.

## Consumer Migration

`autofill.ts` reads cabinet widths, filler minimum, and appliance widths and labels from `CABINET_STANDARDS`. `adjustments.ts` reads the same cabinet-width and filler standards. Existing exported constants may remain temporarily as derived compatibility aliases, but they must reference `CABINET_STANDARDS`; they may not contain independent numeric lists or values.

`STEP_CABINET_WIDTH` and `SET_SEGMENT_KIND` already route through adjustment helpers. Migrating those helpers therefore gives autofill and proposal editing the same width source without adding actions or changing reducer behavior.

## Validation and Errors

The Zod schema requires positive integer dimensions, ascending unique width/height options, a valid non-overlapping door breakpoint, and appliance option sets matching the intended shape. Invalid configuration throws during module initialization. No runtime fallback is provided because an invalid checked-in standard table is a programming/configuration error.

## Testing

Development follows red-green-refactor:

1. Add tests that import the standard table, verify schema parsing, assert the agreed values, and prove malformed tables are rejected.
2. Run those tests and observe failure because the module does not exist.
3. Implement the schema and table.
4. Migrate autofill and adjustment consumers while keeping their existing behavior tests green.
5. Search the Round 2 model code for the removed duplicate standard constants and appliance-width switch values.
6. Run the focused tests, full test suite, TypeScript check, and production build.

## Acceptance Criteria

- `CABINET_STANDARDS` is the sole maintained source for all Phase 6 values.
- Its Zod schema validates the checked-in object and is directly testable.
- Autofill and constrained adjustments consume the shared table.
- Existing autofill, adjustment, state, and drawing behavior does not regress.
- Round 2 model code contains no independently maintained duplicate cabinet-width, filler, or appliance-width standard.
- `npm test`, `npx tsc --noEmit`, and `npm run build` succeed.
