# Temporarily Remove Perspective Rendering Reference

## Goal

Temporarily stop using the generated perspective structure image as an input
reference for Round 1 concept rendering and remove its Round 1 frontend
presentation and generation path.

## Scope

- The client sends the top-down plan and, when available, the material swatch.
- The client does not rasterize or send `PERSPECTIVE_STRUCTURE` when requesting
  a concept rendering.
- The client does not render a perspective thumbnail, perspective lightbox, or
  hidden perspective reference SVG.
- Perspective-specific state, refs, imports, rendering gates, and the unused
  Round 1 lightbox wrapper are removed from the active frontend flow.
- The rendering API requires `TOP_DOWN_PLAN` but no longer requires
  `PERSPECTIVE_STRUCTURE`.
- The API orders accepted references as top-down plan followed by material
  swatch before passing them to the image adapter.
- Rendering prompts, snapshots, cabinet geometry, verification, and saved
  rendering history remain unchanged.
- The standalone perspective preview component and backend role type remain
  available so the feature can be restored without recreating the renderer or
  changing request compatibility.

## Data Flow

1. The showroom generates the top-down SVG preview and rough wall elevations.
2. When the user requests a rendering, the top-down SVG is rasterized as a
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
- Update Round 1 presentation tests so they no longer expect the perspective
  lightbox.
- Verify the active Round 1 app has no perspective state, ref, thumbnail,
  lightbox, hidden generator, or rendering prerequisite.
- Update route tests to prove a top-down-only spatial request is accepted and
  forwarded without perspective data.
- Retain coverage for duplicate roles, rendering preferences, quota checks, and
  adapter behavior.

## Reversal

Restoring the perspective reference requires reconnecting the retained
perspective preview component to the Round 1 UI, adding it back to the client
reference list, and restoring the API requirement and ordering entry. The
perspective renderer itself does not need to be recreated.
