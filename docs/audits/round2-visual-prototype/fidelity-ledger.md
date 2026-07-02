# Round 2 visual prototype fidelity ledger

## Evidence

- Browser: Codex in-app browser against `http://127.0.0.1:3001`
- Reference: `docs/design-references/round2-professional-drawing-reference.png`
- Captures:
  - `handoff-1440.png`
  - `measurement-1440.png`
  - `proposal-1440.png`
  - `proposal-1180.png`
  - `proposal-820.png`
  - `drawings-a1-1440.png`
- Tested viewports: 1440×900, 1180×820, and 820×1180
- Browser console: no errors or warnings during the tested flow

## Comparison

| Area | Reference target | Prototype result |
| --- | --- | --- |
| Drawing language | Black structure, cyan dimensions, orange cabinet boundaries, red cabinet identifiers | Matched across A1–A4 drawing sheets |
| Drawing content | Plan plus wall elevations with exact dimensions | A1 plan and A2–A4 elevations are available as one drawing set; proposal workspace shows top view and selected elevation together |
| Cabinet control | Individually identified cabinets and dimensional chains | Cabinet IDs, widths, wall selection, selected-object linking, sink width and X/Y position controls are present |
| Workflow authority | Field dimensions drive design | Sales owns measurement editing; Designer receives a locked measurement version and can request remeasure but cannot overwrite it |
| Round 1 continuity | Round 2 starts from an approved design | A complete Round 1 snapshot is required, its layout/style/color/appliances are shown before locking, and relocking creates a new reference version |

## Copy changes

- Removed the invented `OPEN SIDE` label and dashed diagonal boundary.
- Added explicit `Position X` and `Position Y` controls in inches.
- Added `Change Round 1`, `Relock for Round 2`, and reference-version messaging.
- Drawing title blocks now use the current customer and project names rather than fixture copy.

## Intentional deviations

- This is a visual and interaction prototype, not a CAD engine. Dimension geometry is representative and does not yet recalculate every chained dimension from a cabinet catalog.
- The reference places several printed sheets in one long export. The prototype uses A1–A4/S1 tabs so each sheet can be reviewed and zoomed independently, while the proposal workspace keeps plan and elevation visible together.
- The current Round 1 data model exposes the latest complete snapshot rather than a multi-snapshot gallery. `Change Round 1` reopens the handoff and a subsequent lock creates the next reference version.
