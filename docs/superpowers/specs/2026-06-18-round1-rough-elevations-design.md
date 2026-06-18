# Round 1 Rough Elevations Design

## Purpose

Add visible, deterministic rough wall elevations under the existing Top-Down Layout Plan after Round 1 cabinet fill is generated. The elevations help sales and customers confirm approximate wall-by-wall placement, and they also become additional reference images for the optional AI concept rendering.

This remains a Module 1 sales-confirmation artifact. It is not a production elevation, not a measured design, and not a cabinet-by-cabinet manufacturing source of truth.

## Product Boundaries

The elevation output must preserve the Round 1 boundary:

- Always present as `Round 1 Rough Elevation`.
- Always mark `Not for production`.
- Show approximate object relationships only.
- Do not expose cabinet codes, production dimensions, filler schedules, door-style details, exact panel splits, exact scribe, exact toe-kick construction, or hardware specifications.
- Do not make elevations editable in Module 1.

The style may borrow the clean CAD-like black-and-white line quality from the supplied reference images, with blue reserved for openings such as windows and doors. The data detail must stay much simpler than those references.

## User Experience

After `Generate Cabinet Fill` succeeds, the preview area shows:

1. The existing `Top-Down Layout Plan`.
2. A new `Rough Wall Elevations` section below it.

The elevation section renders compact wall views for occupied walls:

- `Back Wall`
- `Left Wall`
- `Right Wall`
- `Front Wall` only when the front wall has visible Round 1 objects worth confirming

On desktop, the views can use a compact grid. On mobile, they stack vertically. Empty or irrelevant walls are omitted so the interface stays quiet.

Each wall view should show coarse blocks for:

- Base cabinet runs
- Wall cabinet runs
- Corner cabinet areas when visible on that wall
- Refrigerator
- Range or cooktop
- Hood
- Sink
- Dishwasher
- Wall oven or microwave/oven combo
- Window
- Door

The wall views should include a small label and a stamp line such as `Round 1 rough elevation - not for production`.

## Architecture

Use the existing deterministic `snapshot.floorPlan` as the only geometry input. Do not infer new cabinet data from AI output or generated images.

Create a focused elevation module:

- `src/features/round1/elevations/elevation-scene.ts`
  - Pure builder.
  - Input: `FloorPlan`.
  - Output: deterministic wall elevation scene data.
  - Responsibility: map top-down `PlanRect` objects to rough wall-relative horizontal positions and coarse vertical bands.

- `src/features/round1/elevations/elevation-preview.tsx`
  - Stateless React SVG renderer.
  - Input: `FloorPlan`, optional `svgRef`, optional mode props if needed.
  - Responsibility: render the rough elevation section and expose a single SVG for rasterization.

The builder should reuse the existing camera convention in `src/features/round1/floorplan/spatial-language.ts`:

- `TOP` means the back wall.
- `LEFT` means the left wall.
- `RIGHT` means the right wall.
- `BOTTOM` means the front wall.

The renderer must not call AI or perform persistence. It should be fully deterministic and testable.

## Data Mapping

Each wall elevation uses wall-relative horizontal placement derived from existing floor-plan coordinates:

- For `TOP` and `BOTTOM`, horizontal position comes from object `x`.
- For `LEFT` and `RIGHT`, horizontal position comes from object `y`, ordered from nearest camera to far end where appropriate.

Vertical placement is intentionally coarse:

- Base cabinets occupy a base band.
- Dishwashers and sinks sit in the base band.
- Range/cooktop sits in the base band with an optional hood above.
- Refrigerator and wall oven occupy tall appliance bands.
- Wall cabinets occupy an upper band.
- Windows occupy a middle/upper opening band.
- Doors occupy a tall opening band.

Cabinet and appliance widths should be proportional enough to preserve relative placement, but the rendering should avoid exact production interpretation.

## Rendering Input Flow

The concept rendering request should send multiple deterministic references:

1. Existing clean top-down plan SVG rasterized to PNG.
2. New rough elevation SVG rasterized to PNG.

No API change is required because the route already accepts `referenceImagesBase64: string[]`, and the image client already sends multiple references as repeated `image[]` parts.

The server continues to load the authoritative snapshot by project id. The client continues to send only non-authoritative reference images.

## Error Handling

If the elevation SVG is unavailable at render time, the UI should still generate using the existing top-down reference instead of blocking the user.

If a wall has no objects, omit that wall view. If no elevation views can be built, hide the elevation section and rely on the top-down plan.

## Testing

Add focused coverage:

- `elevation-scene.test.ts`
  - Builds stable wall scenes from a representative L-shape plan.
  - Maps `TOP` to `Back Wall`, `LEFT` to `Left Wall`, and `RIGHT` to `Right Wall`.
  - Omits empty walls.
  - Keeps refrigerator, sink, range/hood, dishwasher, window, and door on their source walls.
  - Marks scenes as rough and not for production.

- `elevation-preview.test.tsx`
  - Renders labels and the not-for-production stamp.
  - Uses blue styling for openings.
  - Does not render cabinet codes or production dimension chains.

- `showroom-intake-app.test.tsx`
  - Confirms rough elevations are hidden before cabinet fill and shown after snapshot generation.
  - Confirms rendering requests include the top-down reference and the elevation reference when both refs are available.

Run verification:

```bash
npm test
npx tsc --noEmit
npm run build
```

Finish with browser QA:

- Generate cabinet fill for the default L-shape.
- Confirm the top-down plan still behaves as before.
- Confirm rough elevations appear below the plan.
- Generate a concept rendering and verify that the output better preserves refrigerator, door, window, corner cabinet, and appliance wall placement.
