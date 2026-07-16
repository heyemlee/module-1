# Proposal wall-overflow warning

## Goal

Make a manually overfull cabinet or appliance run immediately visible in the
editable Technical Design Proposal elevation, and treat any such overflow as a
non-standard design that cannot generate final Technical Design drawings.

## Scope

- The warning exists only in the editable Proposal wall elevation.
- The measured wall end is the reference boundary for each base and upper run.
- The warning uses the selected shaded-overflow treatment: a red dashed wall
  boundary, pale-red diagonal hatching from that boundary to the actual run
  end, and an `OVER WALL BY +X″` label.
- The warning updates after a cabinet width, appliance-width, or other manual
  run-length adjustment.
- A wall overflow creates a blocking decision and prevents final Technical
  Design drawings from being generated or released.
- Generated drawings never include the red warning treatment: users must clear
  all overflows before drawings are available.

## Behavior

1. For each editable elevation tier, sum the rendered segments in wall order.
2. Compare the tier end with the measured wall length.
3. If the run exceeds the wall, render a red dashed vertical line at the wall
   end, hatch only the portion beyond it, and label the exact positive delta.
4. Create or retain a blocking wall-overflow decision using the same delta.
5. The existing proposal/drawing gate prevents final drawing generation while
   any blocking decision exists. Once a resize restores every tier within the
   measured wall, remove the visual warning and unblock the final-drawing path.

## Boundaries

- The visualization is confined to `WallElevation`; drawing-sheet rendering is
  intentionally unchanged.
- Fixed measured openings do not change size to resolve an overflow.
- A run that exactly meets the wall length has no warning.

## Tests

- Proposal elevation shows the dashed boundary, diagonal hatch, and exact
  overage label for an overfull editable tier.
- A standard or exactly closed tier shows none of those warning elements.
- A model with the overflow decision cannot reach final drawing generation;
  removing the overflow restores eligibility.
