# Cabinet span rebalancing — Task 2 report

## Status

Implemented upper post-cut minimum-width enforcement. Ordinary upper fragments
created when a window cuts through a sink or dishwasher projection can no
longer become cabinets narrower than 9 inches.

## Changes

- Added a regression wall with a 24-inch window centered over a 36-inch sink.
  Its two 6-inch post-window upper fragments must be fillers, and the upper
  tier must contain no ordinary cabinet narrower than 9 inches.
- Updated `mapBaseToUpperPiece` so a non-range, non-tall appliance projection
  narrower than `MIN_CABINET_WIDTH_SIXTEENTHS` is emitted as a `filler` piece.
- Reused the existing `residualSegments` policy without modification: 3–6-inch
  fragments emit approved fillers and fragments narrower than 3 inches emit a
  blocking unresolved gap with its decision item.

## Immutable-anchor scope

- Range/hood handling returns before the new guard, so hood zones are
  unchanged.
- Tall appliances still return their existing upper gap before the new guard.
- Window pieces are still emitted from their fixed-point opening interval;
  appliance/base placement is not changed.
- Corner, door/opening, and fixed-point gap handling is unchanged.
- Centered-sink anchoring is untouched; the new guard only changes the upper
  piece classification after the established base placement and window cuts.

## Test-first evidence

The new regression was added before production code. The focused run failed as
expected:

```text
Round 2 autofill > turns a six-inch upper fragment cut from a sink projection into a filler
expected upper segments to contain a filler with widthSixteenths: 96
received W6 cabinet segments at both post-window sink fragments
```

That confirms the fault was in the appliance branch of
`mapBaseToUpperPiece`: it returned an ordinary cabinet before the existing
ordinary-base sliver guard. After the guard was added to the sink/dishwasher
path, the same focused test suite passed.

## Verification

| Command | Result |
| --- | --- |
| `npm test -- src/features/round2/model/autofill.test.ts` before code change | failed: 1 new regression failure, 29 existing tests passed |
| `npm test -- src/features/round2/model/autofill.test.ts` after code change | passed: 30 tests |
| `npx tsc --noEmit` | passed |
| `npm test` | passed: 96 files / 652 tests; 1 skipped file / 1 skipped test |
| `git diff --check` | passed before commit |

## Concerns

None known. The lower-than-3-inch behavior continues to use the pre-existing
blocking-gap path, which is exercised by the model's residual-segment logic;
this task adds no new gap policy.
