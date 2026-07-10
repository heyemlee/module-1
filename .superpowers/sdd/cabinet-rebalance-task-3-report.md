# Cabinet span rebalancing — Task 3 report

## Status

Completed the integration regression for span rebalancing and the existing
staged sink-anchor behavior. No solver or adjustment production code changed:
the already-integrated model satisfies the boundary requirements.

## Regression coverage

Added `preserves appliance widths and a window-centered sink across rebalanced
spans` to `src/features/round2/model/autofill.test.ts`.

The scenario uses a 242-inch wall with a 30-inch window centered at 95 inches,
a dishwasher to the left of the sink, and a range to the right. The ordinary
spans resolve with 5-inch, 4-inch, and 5-inch fillers. The regression asserts:

- Dishwasher width remains the shared 24-inch default.
- Sink-base width remains the shared 36-inch default.
- Range width remains the shared 30-inch default.
- The sink remains `anchored: true` and its center equals the measured window
  center.
- The residual spans retain the expected 5/4/5-inch fillers and both tiers
  close to the measured wall length.

## Test-first / mutation evidence

The new integration scenario passed against the already integrated solver;
Task 3 is a regression-only task, so no production implementation was needed.
To prove the assertion detects the protected behavior, I temporarily mutated
the ordinary appliance reservation width from
`standard.widthSixteenths` to `standard.widthSixteenths - 16` and ran only the
new test. It failed as expected:

```text
Round 2 autofill > preserves appliance widths and a window-centered sink across rebalanced spans
expected 368 to be 384
```

The mutation was restored exactly. The same focused test then passed, and the
production solver file has no diff.

## Verification

| Command | Result |
| --- | --- |
| `npm test -- src/features/round2/model/adjustments.test.ts src/features/round2/model/autofill.test.ts` before the regression | 52 passed |
| `npm test -- src/features/round2/model/autofill.test.ts` after adding the regression | 31 passed |
| `npm test -- src/features/round2/model/autofill.test.ts -t "preserves appliance widths and a window-centered sink across rebalanced spans"` with temporary mutation | failed as expected: dishwasher 368 vs standard 384 |
| Same focused regression after restoring the mutation | 1 passed |
| `npm test -- src/features/round2/model/autofill.test.ts src/features/round2/model/adjustments.test.ts && npx tsc --noEmit && npm run build` | 53 model tests passed; TypeScript passed; production build passed |
| `git diff --check` | passed |

## Concerns

None known. The regression keeps the user-staged anchor/recentering behavior
in scope without changing it; ordinary span partitioning remains confined to
the space between fixed reservations.
