# Round 1 Rendering Preferences Design

Date: 2026-06-19

## Context

Round 1 concept renderings currently use a hard-coded European frameless cabinet style and medium-tone wood cabinet fronts in the rendering prompt. The user wants customers to choose the rendering cabinet style and door color before generating a customer-facing concept image.

This design keeps the existing Round 1 boundary intact:

- The deterministic floor plan, cabinet count, cabinet fill, readiness, and production gate remain authoritative.
- Rendering preferences affect only customer concept renderings.
- Generated renderings remain non-authoritative and never feed back into cabinet data, dimensions, quote data, or production readiness.

## Goals

- Add a dedicated Rendering Preferences step after Adjust Positions.
- Let Sales pick a cabinet style: European frameless or American framed.
- Let customers browse large square door-color boards from the selected style's independent color library.
- Use real uploaded door-panel or material texture images for color swatches.
- Show a hover example image for each color when available.
- Require explicit confirmation after clicking a color before saving it as selected.
- Let Admin manage the European and American color libraries.
- Feed the selected style and color prompt description into the rendering prompt.

## Non-Goals

- Do not add countertop, floor, wall, hardware, or backsplash selection in this pass.
- Do not make rendering preferences part of production-ready data.
- Do not add pricing or quote behavior.
- Do not expose color-library editing to Sales or Designer roles.
- Do not require image upload storage implementation in the first implementation pass if a URL-based boundary is faster to ship.

## User Flow

The Round 1 workflow becomes:

1. Room
2. Openings
3. Layout
4. Appliances
5. Adjust Positions
6. Rendering Preferences

The Rendering Preferences step contains:

- A cabinet style control with `European Frameless` and `American Framed`.
- A large square color board for the selected style's active colors.
- A hover preview area that shows the selected color's example image while the customer hovers over a color tile.
- A click-to-confirm color selection flow.
- The final Round 1 actions: generate cabinet fill when needed, then generate or regenerate the concept rendering when a saved snapshot exists.

Adjust Positions should focus on dragging and confirming fixed positions. Rendering Preferences becomes the place where Sales confirms the customer's visual preference before freezing or refreshing the customer-facing concept image.

Color selection behavior:

1. Customer hovers over a large square swatch.
2. If the color has a hover example image, the UI shows it as a reference example.
3. Customer clicks the swatch.
4. The app opens a confirmation dialog with a larger swatch image, color name, and color code when present.
5. Only after `Confirm Color` does the app write `renderingPreferences.doorColorId`.
6. `Cancel` closes the dialog without changing the saved selection.

Style switching behavior:

- European style shows only European colors.
- American style shows only American colors.
- If the current `doorColorId` does not belong to the newly selected style, the selection is cleared and the user must confirm a valid color from the new library.

## Sales UI Details

The color board should use large, image-first square tiles. The tile image uses `swatchImageUrl` first and `swatchHex` only as a fallback when no image is available or the image fails to load.

Each tile should show:

- Large square material image.
- Color name.
- Optional color code.
- Selected state after confirmation.

The hover example should:

- Use `hoverExampleImageUrl` when available.
- Be clearly framed as a reference example, not a promise of the final rendering.
- Fall back gracefully when missing by showing no example image or a neutral message.

`Generate Rendering` should be disabled until:

- A valid snapshot exists and is saved.
- A cabinet style is selected.
- A valid active door color from that style's library is confirmed.

The Rendering Preferences step should support two valid states:

- Before cabinet fill: Sales can select style and color, then generate cabinet fill so the saved Round 1 state and snapshot audit copy both reflect the current visual preference.
- After cabinet fill: Sales can change style or color without invalidating cabinet fill; this only marks the latest rendering stale and allows regeneration from the same locked layout snapshot.

Changing rendering preferences should not clear cabinet fill or the Round 1 snapshot. It should make the existing latest rendering stale because the visual preference no longer matches the rendered image.

## Data Model

Add rendering preferences to the Round 1 form data:

```ts
type Round1RenderingPreferences = {
  cabinetStyle: "EUROPEAN_FRAMELESS" | "AMERICAN_FRAMED";
  doorColorId: string | null;
};
```

Add the field at the top level of `Round1FormInput`:

```ts
renderingPreferences: Round1RenderingPreferences;
```

The project should persist rendering preferences as editable Round 1 state. The authoritative snapshot may copy the preferences present at cabinet-fill generation time for audit context, but rendering generation should use the project's current saved rendering preferences plus the locked snapshot geometry. This keeps the layout source of truth stable while allowing Sales to change the visual color/style and regenerate the concept image without rebuilding cabinet fill.

The rendering route should load the authoritative snapshot server-side as it does today, load the project's current rendering preferences, then resolve the selected color from the company's active color library before building the prompt. If a selected color has since been disabled, the route should reject regeneration and ask the user to choose an active color.

## Admin Color Library

Add an Admin-only color library management area, for example `Admin / Cabinet Colors`.

Admin can manage separate color libraries for:

- `EUROPEAN_FRAMELESS`
- `AMERICAN_FRAMED`

Each color item should support:

```ts
type CabinetColorLibraryItem = {
  id: string;
  companyId: string;
  cabinetStyle: "EUROPEAN_FRAMELESS" | "AMERICAN_FRAMED";
  name: string;
  colorCode: string | null;
  swatchImageUrl: string | null;
  swatchHex: string | null;
  hoverExampleImageUrl: string | null;
  promptDescription: string;
  active: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};
```

Admin capabilities:

- Create a color.
- Edit name, code, swatch image URL, fallback hex, hover example image URL, prompt description, active status, and sort order.
- Deactivate colors instead of deleting them when existing projects may reference them.
- View colors grouped by cabinet style.

Sales and Designer capabilities:

- Read active colors for the current company.
- Select an active color in Round 1.
- Cannot create, edit, reorder, activate, or deactivate color library items.

Persistence should be company-scoped via `companyId`, matching the platform's internal project model. In the first implementation pass, image fields may be URLs. A later storage pass can add direct file upload without changing the Sales selection model.

## Prompt Design

The rendering prompt should stop hard-coding a single cabinet style and color. It should compose cabinetry language from:

- The snapshot's layout, appliance, and floor-plan data.
- The current saved cabinet style.
- The selected color library item's `promptDescription`.

European style prompt language:

- Modern frameless European-style cabinetry.
- Flat slab doors.
- Handleless or clean integrated pulls depending on final product language.
- Clean reveals and continuous toe kicks.
- No crown molding, soffit, or top trim unless explicitly desired later.

American style prompt language:

- American framed cabinetry.
- Face-frame construction cues.
- Shaker or framed door language only when the selected product/color entry describes it.
- Residential American proportions.
- Hardware or no-hardware language should come from the chosen product style, not be invented by the image prompt.

Color prompt language:

- Use the selected color item's `promptDescription`.
- Do not infer final color from `swatchImageUrl` or `hoverExampleImageUrl`.
- Do not allow the image model to replace the selected color with unrelated finishes.

The prompt should keep existing safety language:

- Sales-estimate concept image only.
- Not a production drawing.
- No dimensions, cabinet codes, labels, legends, or text on image.
- Keep all walls, openings, appliances, corner cabinets, island or peninsula, and cabinet runs aligned to the deterministic reference images.

## Error Handling

No active colors for selected style:

- Sales UI shows that an Admin must configure the color library.
- Generate Rendering remains disabled.

Missing or failed swatch image:

- Show color name and fallback `swatchHex` if present.
- Do not block selection if the item is active and has a prompt description.

Missing hover example:

- Skip the example image and keep the color tile usable.

Selected color no longer active:

- Existing project may display the old color name if stored or resolvable.
- Regenerating rendering requires choosing an active color.

Cross-library color mismatch:

- UI prevents this by filtering colors by selected style.
- Schema and server-side validation reject it if it appears through stale saved data, local storage edits, old projects, or API misuse.

## Architecture

Suggested implementation units:

- Domain schema: extend `Round1FormInput` with rendering preferences.
- Feature data: default rendering preferences and color-library types.
- Sales UI: `RenderingPreferencesStep`, large color board, hover preview, and confirmation dialog.
- Prompt builder: style and color prompt helpers consumed by `buildRound1RenderingPrompt`.
- Server repository: company-scoped cabinet color library access.
- Admin UI: color library management page and API routes.
- Rendering service: resolve and validate selected color before prompt generation.

Keep rendering preference edits separate from layout-critical form edits:

- Layout-critical edits continue to clear cabinet fill and snapshot.
- Rendering preference edits should only mark latest rendering stale.

`latestRendering` should record enough preference metadata to detect staleness, for example:

```ts
basedOnRenderingPreferences: {
  cabinetStyle: "EUROPEAN_FRAMELESS" | "AMERICAN_FRAMED";
  doorColorId: string;
  colorUpdatedAt: string | null;
};
```

The UI can mark a rendering stale when the current saved preferences differ from the rendering's recorded preferences, even if the snapshot timestamp is unchanged.

## Testing

Unit and integration tests should cover:

- Schema accepts valid rendering preferences.
- Schema rejects or normalizes invalid style/color combinations.
- Changing style clears a mismatched selected color.
- Sales UI shows only active colors for the selected style.
- Color click opens confirmation and only confirm writes `doorColorId`.
- Missing hover example does not break the color board.
- Prompt includes the correct cabinet style language.
- Prompt includes the selected color's `promptDescription`.
- Prompt no longer always hard-codes European medium-tone wood.
- Admin APIs require `ADMIN`.
- Sales and Designer cannot mutate color library items.
- Rendering generation rejects inactive or cross-style selected colors.

## Open Decisions Resolved

- Only cabinet door color is selected in Round 1.
- European and American colors use independent libraries.
- Color selection uses large square boards, not dropdowns.
- Swatches use real uploaded door-panel or material texture images.
- Hover examples are supported and Admin-configurable.
- Clicking a color requires explicit confirmation before saving.
- Admin manages color libraries; Sales only selects from active colors.
