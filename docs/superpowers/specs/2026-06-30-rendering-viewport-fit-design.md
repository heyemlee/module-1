# Round 1 Rendering Viewport Fit

## Goal

On Round 1 step 04, show the entire concept rendering in the initial canvas
viewport without requiring vertical scrolling and without cropping or stretching
the generated image.

## Confirmed layout

- Steps 01–03 remain unchanged. Their wall-elevation thumbnail strip stays
  pinned to the bottom of the canvas and requires no page scrolling.
- Step 04 becomes one vertical scroll flow in this order:
  1. complete concept rendering
  2. layout preview
  3. wall-elevation thumbnail strip
- The rendering occupies the available step-04 canvas viewport. Its content
  scales against both available width and height and uses containment so the
  complete source image remains visible at different image aspect ratios.
- Layout and elevation content starts below the first viewport and remains
  reachable by scrolling the step-04 canvas.

## Component boundaries

- `ShowroomIntakeApp` owns the step-specific composition and places the
  elevation strip inside the step-04 scroll flow only.
- `Round1InlineRenderPreview` owns rendering presentation and exposes a
  viewport-fit mode. Existing loading, error, empty, metadata, and carousel
  behavior remains intact.
- `Round1ElevationStrip` remains reusable and unchanged in steps 01–03.

## Responsive behavior

- Desktop and short desktop viewports prioritize the complete rendering.
- Narrow viewports preserve the source image with containment; letterboxing is
  acceptable when the viewport and source aspect ratios differ.
- No new breakpoint-specific navigation or controls are introduced.

## Verification

- Add a regression test that proves the step-04 flow order and viewport-fit
  styling contract.
- Run the focused Round 1 tests, then the full test suite.
- In the in-app browser, verify the initial step-04 viewport at desktop and a
  shorter/narrower viewport: the whole image is visible before scrolling, and
  scrolling reveals layout followed by wall elevations.

