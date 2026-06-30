# High-Fidelity Rendering References Design

## Goal

Make a single Round 1 concept-rendering request preserve the frozen kitchen
layout much more reliably, especially the attachment, orientation, and cabinet
faces of peninsula, L-shaped, U-shaped, galley, and island layouts.

The result remains a non-authoritative sales concept. Exact production geometry
still belongs to the frozen Round 1 snapshot.

## Current Failure

The current request sends an implicit array of PNG files:

1. top-down floor plan;
2. a multi-wall elevation sheet;
3. an optional material swatch.

The JSON snapshot is not sent as structured constraints. It is translated into
natural-language prompt text. The multipart image request does not identify the
role of each image, does not request high input fidelity, and gives the model no
camera-perspective structural reference. A top-down plan cannot uniquely
determine how an attached peninsula should look from a particular 3D camera.

The saved prompt can therefore be correct while the generated composition is
still wrong. This is consistent with the documented composition-control limits
of GPT Image.

## Accepted Approach

Use one high-fidelity image-edit request with explicit reference roles and a
deterministic perspective blockout as the primary image:

1. `PERSPECTIVE_STRUCTURE` — authoritative camera and 3D massing reference;
2. `TOP_DOWN_PLAN` — authoritative wall, run, opening, and appliance positions;
3. `WALL_ELEVATIONS` — authoritative vertical stacking and cabinet heights;
4. `MATERIAL_SWATCH` — optional finish-only reference.

The first three references must come from the same frozen snapshot. The
material swatch may come from the selected rendering preference.

## Reference Data Contract

Replace the implicit `string[]` boundary between the browser and rendering
service with:

```ts
type RenderingReferenceRole =
  | "PERSPECTIVE_STRUCTURE"
  | "TOP_DOWN_PLAN"
  | "WALL_ELEVATIONS"
  | "MATERIAL_SWATCH";

type RenderingReference = {
  role: RenderingReferenceRole;
  imageBase64: string;
};
```

The API route validates:

- at least one perspective structure reference;
- at least one top-down plan reference;
- no duplicate spatial roles;
- non-empty base64 payloads;
- the fixed role order before calling the image adapter.

This removes reliance on array position inside application code. The adapter
still sends image parts in the fixed order required by the Images API.

## Perspective Structure Reference

Add a hidden, deterministic SVG generated from `snapshot.floorPlan`. It is a
clean structural blockout, not a photorealistic image.

It contains:

- the back and side wall planes;
- floor and opening locations;
- base, wall, tall, island, and peninsula cabinet masses;
- appliance masses;
- continuous countertop outlines;
- a clearly visible peninsula attachment with no gap;
- cabinet-face direction marks;
- a fixed camera/view cone selected by layout.

The projection is deterministic and uses the same plan rectangles as the
top-down view. It must not recompute layout from the form.

For a peninsula layout, the camera is placed on the open side near the free end,
looking diagonally toward the anchor and back wall. The attachment, complete
free end, and cabinet fronts on the work side must all be visible.

Layout camera selection:

- one-wall: centered front;
- left L: open front-right;
- right L: open front-left;
- U: centered outside the open end;
- galley: open aisle end;
- peninsula: open side near the peninsula free end, aimed at the anchor;
- island variants: pulled-back three-quarter view retaining the full island.

The SVG may include small reference-only role and orientation labels. The
generation prompt explicitly forbids copying labels into the final render.

## Prompt Contract

The prompt names reference roles in the exact upload order:

- Reference 1 controls camera and 3D massing.
- Reference 2 controls top-down positions.
- Reference 3 controls vertical stacking only and must not override floor-plan
  geometry.
- Reference 4, when present, controls material only.

For peninsula layouts it explicitly states:

- attached base-cabinet run, never a detached island;
- shared continuous countertop at the anchor;
- cabinet fronts face the work zone;
- no full-height blank island panel in place of the peninsula cabinet run;
- attachment and free end remain visible.

Rough intake relations such as `UNKNOWN` must not produce phrases like
“on an unconfirmed wall” when the deterministic floor plan already places that
appliance. The geometry-derived wall walkthrough is authoritative.

## Image API Request

The Images edit request sets:

```text
input_fidelity=high
```

for GPT Image models that support it. The existing configured model remains
unchanged. The request still generates one landscape image.

If the configured model is not a GPT Image model, the client omits the
unsupported field rather than breaking the existing fallback path.

## Error Handling

- Fail before billing an image request when required spatial references are
  absent.
- Do not silently fall back to top-down-only generation.
- If the optional elevation or swatch cannot rasterize, continue only when the
  perspective and top-down references exist.
- Keep the current timeout and user-facing rendering error handling.

## Testing

Add tests at each boundary:

1. perspective scene geometry uses the frozen plan and keeps peninsula masses
   touching the anchor;
2. hidden reference render exposes the perspective SVG;
3. rasterization preserves explicit roles and fixed order;
4. route rejects missing or duplicate required roles;
5. service produces role-aware prompt language;
6. prompt contains no contradictory “unconfirmed wall” placement;
7. adapter forwards `inputFidelity: "high"`;
8. REST multipart body contains `input_fidelity=high`;
9. existing top-down, elevation, snapshot, and complete flow tests remain green.

## Non-Goals

- No production-grade 3D/CAD renderer.
- No second paid generation or automatic retry in this change.
- No claim that a generative model can guarantee production accuracy.
- No change to cabinet estimation or frozen snapshot ownership.
- No redesign of the customer rendering gallery.

