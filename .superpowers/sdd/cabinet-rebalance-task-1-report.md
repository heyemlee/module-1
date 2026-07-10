# Cabinet span rebalancing — Task 1 report

## Status

Implemented the Task 1 standard-width base-span partition solver and integrated
it with the already staged centered-sink anchor work in the single
`fix: rebalance cabinet span fillers` commit.

## Changes

- Replaced the greedy `fillSpan` loop with an exact standard-base-width search.
- Ranks no filler first, then the configured 3/4/5/6-inch filler widths; a
  custom sixteenth-inch filler is used only when it remains inside the approved
  3–6-inch range and a fixed-point span cannot use one of those preferred
  widths.
- Emits one blocking unresolved gap for a span with no valid standard-cabinet
  plus approved-filler partition; it no longer splits a larger residual into
  multiple fillers.
- Keeps ordinary cabinets on configured standards and at least 9 inches wide.
- Preserves fixed appliances, openings, corners, and staged anchored-sink
  behavior because only the independent ordinary spans between those anchors are
  partitioned.
- Replaced the stale 43-inch expectation with `B24 + B15 + F4`; added coverage
  for the 42-inch exact span and the unsolvable 9 1/16-inch span.
- Aligned the elevation test with the staged removal of SVG title tooltips; the
  full suite had exposed that stale assertion.

## Test-first evidence

Before production changes, the focused autofill suite failed exactly as
expected:

- 42 inches produced only a 36-inch cabinet instead of an exact standard
  cabinet partition.
- 43 inches produced 3-inch and 4-inch fillers instead of one 4-inch filler.
- 9 1/16 inches produced a 9-inch cabinet plus a 1/16-inch gap instead of one
  blocking unresolved span.

After the solver change, `npm test -- src/features/round2/model/autofill.test.ts`
passed all 29 tests.

## Verification

| Command | Result |
| --- | --- |
| `npm test -- src/features/round2/model/autofill.test.ts` | 29 passed |
| `npm test -- src/features/round2/model/autofill.test.ts src/features/round2/model/adjustments.test.ts` | 51 passed |
| `npm test -- src/features/round2/proposal/wall-elevation.test.tsx` | 45 passed |
| `npx tsc --noEmit` | passed |
| `npm run build` | passed |
| `npm test` | 96 files / 651 tests passed; 1 intentional skip |
| `git diff --check` and `git diff --cached --check` | passed |

## Integration notes

- The previously staged sink anchor/recentering files were retained and are
  included in the integrated commit.
- A centered sink remains an adjustment-zone boundary. The solver only handles
  the ordinary span on either side, so appliance widths and placement are not
  resized.
- The one initial full-suite failure was traced to the staged elevation change
  that deliberately removes `Corner return` SVG title tooltips; its older test
  asserted the opposite. The assertion now checks the intended no-tooltip
  behavior.

## Concerns

None known after the checks above. The solver performs a small memoized search
over the configured standard width set; fixed-point spans can still use a
single custom-width filler only inside the approved 3–6-inch range.
