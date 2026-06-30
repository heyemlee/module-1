# Layout-Aware Rendering Camera and Microwave Placement

## Goal

Improve the Round 1 image prompt and its spatial inputs so each kitchen layout
is shown completely in one photorealistic rendering, while microwave cabinetry
matches the appliance's actual configuration and placement.

## Findings

- The current prompt hard-codes one camera: front of room, straight toward the
  back wall, with the front wall behind the camera.
- That camera can crop the near end of L- and U-shaped returns and necessarily
  hides the second run of a galley because the galley uses the back and front
  walls.
- The deterministic geometry already distinguishes these layouts:
  - left L: back + left walls
  - right L: back + right walls
  - U: back + left + right walls
  - galley: back + front parallel walls
  - peninsula: back + left walls plus a freestanding, wall-anchored peninsula
- The current geometry can mark an appliance as mounted on a peninsula, but it
  cannot mark an appliance as mounted on an island.
- A stacked oven/microwave is currently eligible for peninsula placement even
  though the renderer represents it as a tall appliance.

## Camera policy

Every rendering uses perspective with corrected verticals, a moderately wide
architectural field of view, and enough camera distance to keep every required
cabinet run inside the frame with visible margin. The prompt forbids cropped
cabinetry, fisheye distortion, mirrored geometry, and moving appliances between
surfaces.

- **One wall:** centered front view, pulled back until the complete run and both
  ends are visible.
- **Left L:** three-quarter view from the open front-right side, aimed toward the
  inside corner; the complete back and left runs must be visible.
- **Right L:** mirrored camera position from the open front-left side; the
  complete back and right runs must be visible without mirroring the layout.
- **U:** centered outside the open end and slightly elevated; the back run and
  both returns must be visible from their corners to their open ends.
- **Galley:** one rendering only. Place the camera at an open end of the aisle,
  slightly elevated and angled down the aisle so the complete back-wall and
  front-wall parallel runs are visible together. The front wall is visible and
  must not be described as behind the camera.
- **Peninsula:** three-quarter view from the open side opposite the peninsula
  anchor, pulled back enough to show the complete wall runs, the peninsula's
  attachment point, and its free end.
- **Island layouts and fallback:** pulled-back three-quarter view that keeps the
  complete perimeter layout and full island inside the frame.

## Prompt architecture

- Replace the global fixed-camera sentence with a deterministic
  layout-to-camera-policy function.
- Choose visible wall walkthroughs by layout. Galley includes both `TOP` and
  `BOTTOM`; other layouts keep only walls visible from their camera policy.
- Make front-wall door and appliance language aware of whether the front wall is
  visible. Galley must describe front-wall contents in the walkthrough and must
  not emit the existing "behind the viewpoint" contradiction.
- Keep one prompt, one OpenAI image request, one saved rendering, and one quota
  entry per Generate Rendering action.

## Microwave placement rules

- `WALL_OVEN_MICROWAVE_STACK` means a microwave above a wall oven in one tall
  appliance cabinet. That stacked appliance cannot be mounted on an island or
  peninsula.
- `MICROWAVE_DRAWER` means an under-counter drawer appliance in a base cabinet.
- `UPPER_CABINET_MICROWAVE` remains in an upper wall cabinet.
- `COUNTERTOP_MICROWAVE` remains a countertop appliance and must not be enclosed
  as a built-in unit.
- A standalone built-in microwave whose frozen floor-plan appliance is mounted
  on an island or peninsula is rendered under-counter in that base cabinet. The
  prompt explicitly forbids adding a tall cabinet, wall-oven tower, or upper
  cabinet at that location.
- Add an island-mounted marker to the deterministic floor plan and allow the
  standalone microwave appliance to be dropped on an existing island. Reuse the
  existing peninsula marker for peninsula placement.
- Remove the stacked oven/microwave appliance from peninsula drop targets.

## Scope boundaries

- No second galley rendering and no multi-image API response.
- No pricing, production dimensions, or appliance model selection.
- No broad redesign of appliance placement. Island mounting is limited to the
  standalone microwave case required for correct rendering semantics.
- Existing viewport-fit work remains unchanged.

## Industry basis

- KraftMaid defines L layouts as two perpendicular runs, U layouts as three
  sides, galley layouts as opposing parallel work zones, and a peninsula as a
  wall-anchored extension:
  <https://www.kraftmaid.com/plan/plan-your-project/kitchen-layouts/>
- Sharp documents microwave drawers for under-counter installation in islands,
  peninsulas, and standard base cabinetry:
  <https://simplybetterliving.sharpusa.com/simply-better-you/can-you-put-a-microwave-in-a-kitchen-island/>
- Bosch documents drawer microwaves for under-counter islands and speed
  ovens/microwaves combined vertically with wall ovens:
  <https://www.bosch-home.com/us/products/cooking-baking/microwaves/compare-products>
- Chaos camera documentation confirms that a wider field of view zooms out and
  two-point/tilt correction keeps architectural verticals straight:
  <https://docs.chaos.com/display/ENVISION/Camera+Details>

## Verification

- Prompt tests cover one-wall, left L, right L, U, galley, peninsula, and
  island/fallback camera language.
- Galley tests prove both parallel walls are walked and no front-wall
  "behind-camera" language remains.
- Geometry and prompt tests prove a peninsula/island microwave becomes an
  under-counter appliance with a no-tall-cabinet constraint.
- Geometry tests prove a stacked wall-oven/microwave cannot mount on a
  peninsula or island.
- Run focused Round 1 tests, the complete test suite, and a production build.

