# Temporarily Remove Perspective Rendering Reference

## Goal

Temporarily stop using the generated perspective structure image as an input
reference for Round 1 concept rendering. Keep the perspective preview itself
available in the showroom UI so the change is easy to reverse.

## Scope

- The client sends the top-down plan and, when available, the material swatch.
- The client does not rasterize or send `PERSPECTIVE_STRUCTURE` when requesting
  a concept rendering.
- The rendering API requires `TOP_DOWN_PLAN` but no longer requires
  `PERSPECTIVE_STRUCTURE`.
- The API orders accepted references as top-down plan followed by material
  swatch before passing them to the image adapter.
- Perspective preview generation and display remain unchanged.
- Rendering prompts, snapshots, cabinet geometry, verification, and saved
  rendering history remain unchanged.

## Data Flow

1. The showroom keeps generating its perspective and top-down SVG previews.
2. When the user requests a rendering, only the top-down SVG is rasterized as a
   spatial reference.
3. An optional material swatch is appended.
4. The API validates that the top-down reference exists, rejects duplicate
   roles, and forwards the ordered images to the rendering service.

## Error Handling

A request without `TOP_DOWN_PLAN` returns the existing 400-class validation
response with wording that identifies the top-down plan as the required spatial
reference. All other rendering errors retain their current behavior.

## Verification

- Update client reference tests to prove the perspective reference is omitted.
- Update route tests to prove a top-down-only spatial request is accepted and
  forwarded without perspective data.
- Retain coverage for duplicate roles, rendering preferences, quota checks, and
  adapter behavior.

## Reversal

Restoring the perspective reference requires adding it back to the client
reference list and restoring the API requirement and ordering entry. No
perspective preview code needs to be recreated.
