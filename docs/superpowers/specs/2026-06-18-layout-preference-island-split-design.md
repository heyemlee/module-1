# Layout Preference Island Split Design

Date: 2026-06-18

## Goal

Separate the base kitchen shape from island intent in the Round 1 Layout Preference step, and split L-shape layouts into explicit left-L and right-L choices.

## Behavior

- The Layout Preference step shows common base layouts first: `LEFT_L_SHAPE`, `RIGHT_L_SHAPE`, `U_SHAPE`, `ONE_WALL`, then `GALLEY`, `PENINSULA`, and `NO_PREFERENCE`.
- The UI no longer offers `L_SHAPE_ISLAND`, `U_SHAPE_ISLAND`, or standalone `ISLAND` as kitchen shape choices.
- A separate `Need island?` field appears in the same step with `YES`, `NO`, and `UNKNOWN`.
- `YES` generates an island run and island guide/geometry. `NO` and `UNKNOWN` do not generate island geometry by default.
- `LEFT_L_SHAPE` uses the top and left walls. `RIGHT_L_SHAPE` uses the top and right walls.

## Compatibility

- Existing saved values remain parseable. Legacy `L_SHAPE` behaves like `LEFT_L_SHAPE`; legacy island-shaped values can still be read by old snapshots/tests, but they are not offered in the default UI.
- The snapshot keeps capturing the full `showroomForm`, normalized JSON, position overrides, cabinet fill, and deterministic floor plan at `Generate Cabinet Fill`.

## Testing

- Add unit coverage for the Layout Preference UI options and island status field.
- Add cabinet-run coverage for left-L, right-L, and island status.
- Add geometry coverage for left-L and right-L allowed walls.
