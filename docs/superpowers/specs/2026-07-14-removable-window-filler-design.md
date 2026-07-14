# Removable Window Filler Design

## Goal

Allow a designer to remove a filler beside a window while preserving the
filler's measured width as intentional open space. Removing the filler must not
repack, resize, or shift adjacent cabinets.

## Interaction

- Selecting a filler opens the existing segment editor.
- The editor adds a `Remove filler` action with explicit copy that the space
  will remain open.
- The filler becomes an open `gap` segment at the same index and width.
- The editor for that gap offers `Restore filler`, returning it to the same
  position and width.
- The elevation renders the gap as open space with a restrained dashed/gray
  treatment and keeps its dimension label.

## Model and state

The transition is a pure model adjustment. It preserves segment identity,
order, tier, wall, width, and labels while changing only `kind` and a small
marker indicating the gap was intentionally converted from filler. The
existing autofill must preserve intentional gaps across regeneration and must
not interpret them as unresolved gaps.

New prototype actions are `REMOVE_FILLER` and `RESTORE_FILLER`. Both use the
existing proposal-adjustment path so proposal and drawing statuses stay in
sync and the selected object remains selected.

## Validation

- Unit tests cover filler-to-gap conversion, gap-to-filler restoration, width
  and order preservation, and no-op behavior for non-filler/non-restorable
  segments.
- Component tests cover both buttons and the copy shown in the editor.
- Browser QA verifies the round2 proposal page loads without errors, the
  selected filler can be removed, the elevation retains the same open-space
  width, and the filler can be restored.
