# Cabinet Span Rebalancing Design

## Purpose

Prevent undersized cabinets in Round 2 proposal elevations and resolve leftover wall space predictably while preserving appliance and opening constraints.

## Constraints

- Fixed appliances, windows, doors, and corner reservations are immutable anchors; the autofill solver must not resize them.
- Both base and ordinary upper cabinets have a minimum width of 9 inches.
- Fillers are permitted only from 3 through 6 inches, with 3 inches preferred.
- The 03 Drawings & Review projection continues to use the same deterministic model produced for 02 Design Proposal.

## Solver Policy

Solve each uninterrupted span between immutable anchors independently. First choose standard-width ordinary cabinets. A 3-inch remainder is the ideal filler. A 4- or 5-inch remainder remains a valid filler when no standard-width adjustment of an adjacent ordinary cabinet produces a 3-inch filler. For a 6-inch remainder, first try widening an adjacent adjustable cabinet by one standard 3-inch tier to leave a 3-inch filler; retain the 6-inch filler only when that adjustment is impossible.

For a 1- or 2-inch remainder, step an adjacent ordinary cabinet down one available tier so the resulting 4- or 5-inch remainder becomes a valid filler. For a remainder greater than 6 inches, repartition the span before allowing multiple fillers. If no valid partition is possible, emit a blocking decision rather than creating an undersized cabinet.

The upper tier follows the same policy after its base seams are projected and cut by windows, hood zones, and tall units. Any post-cut piece smaller than 9 inches must resolve as a filler or a blocking decision, never as an upper cabinet. Aligning upper seams to base seams is a preference, not permission to create an undersized unit.

## Selection Order

Candidate solutions are ranked in this order:

1. Preserve all immutable anchors.
2. Reject any ordinary cabinet below 9 inches.
3. Reject fillers outside 3–6 inches.
4. Prefer one 3-inch filler; then prefer the filler width nearest 3 inches.
5. Prefer fewer fillers and fewer cabinet changes.
6. Prefer upper/base seam alignment when the earlier constraints tie.

## Verification

Add focused autofill coverage for appliance/window-carved upper slivers and base-span residuals. Verify that 6-inch upper fragments become fillers, 6-inch residuals rebalance to a 3-inch filler when an adjacent ordinary cabinet can widen, appliances remain unchanged, and unresolved spans create a blocking decision rather than an undersized cabinet.
