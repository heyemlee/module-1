# Round 1 Rendering Preferences Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Admin-managed cabinet color libraries and a Round 1 Rendering Preferences step that lets Sales choose European/American cabinet style and a confirmed door-color texture before generating customer concept renderings.

**Architecture:** Keep layout authority in the existing Round 1 snapshot and store visual rendering preferences as editable project state. Add a company-scoped cabinet color library in Postgres, expose Admin-only mutation APIs plus read APIs for Sales, and pass the current saved style/color into the rendering prompt and rendering history for staleness detection.

**Tech Stack:** Next.js App Router, TypeScript, React, Tailwind CSS, Zod, Vitest, Postgres via `pg`, existing OpenAI image adapter boundary.

---

## Scope And Ordering

This plan intentionally spans several connected slices because they must work together for a usable feature:

1. Domain/schema/default state.
2. Database/repository/API for color libraries and rendering preferences.
3. Admin color library management UI.
4. Sales Rendering Preferences step and color-board interaction.
5. Rendering prompt/service/history integration.
6. Verification and handoff.

Before starting implementation, run `git status --short`. The current workspace may already contain unrelated Admin user-management work. Do not revert it. If implementation touches the same files, read the current file and preserve existing user changes.

## File Structure

Create or modify these files:

- Modify: `src/domain/round1/schemas.ts`
  - Adds rendering preference schema and exports the `Round1RenderingPreferences` type.
- Modify: `src/features/round1/showroom-intake-data.ts`
  - Adds default rendering preferences.
- Modify: `src/features/round1/snapshot.ts`
  - Optionally copies rendering preferences into snapshot audit context without making them authoritative for layout.
- Create: `src/server/platform/cabinet-color-repository.ts`
  - Owns company-scoped cabinet color CRUD/listing and style/color validation helpers.
- Create: `src/server/platform/cabinet-color-repository.test.ts`
  - Tests row mapping, style filtering, active filtering, and validation helpers without needing a live DB.
- Modify: `src/server/db/schema.sql`
  - Adds `cabinet_colors` table and rendering preference metadata columns on `renderings`.
- Modify: `src/server/db/schema.test.ts`
  - Verifies new tables/columns are present.
- Create: `src/app/api/admin/cabinet-colors/route.ts`
  - Admin-only list/create endpoint.
- Create: `src/app/api/admin/cabinet-colors/[colorId]/route.ts`
  - Admin-only update endpoint.
- Create: `src/app/api/cabinet-colors/route.ts`
  - Authenticated read-only active-color list for Round 1.
- Create: `src/app/api/admin/cabinet-colors/route.test.ts`
  - Tests request validation and role boundaries by exercising exported pure helpers.
- Create: `src/features/platform/cabinet-colors-admin-view.tsx`
  - Admin management screen.
- Create: `src/features/platform/cabinet-color-form.tsx`
  - Client form for creating/editing color records.
- Create: `src/features/platform/cabinet-color-form.test.tsx`
  - Static/rendered interaction tests for form labels and payload shaping helpers.
- Create: `src/app/admin/cabinet-colors/page.tsx`
  - Admin page guard and server-side color loading.
- Modify: `src/features/platform/project-dashboard.tsx`
  - Adds Admin link to `Cabinet Colors`.
- Create: `src/features/round1/rendering-preferences.ts`
  - Shared color/style labels and helpers used by UI and prompt code.
- Create: `src/features/round1/rendering-preferences-step.tsx`
  - Sales color-board UI with hover preview and confirm dialog.
- Create: `src/features/round1/rendering-preferences-step.test.tsx`
  - Tests style filtering, click confirmation, and style switching.
- Modify: `src/features/round1/showroom-intake-steps.tsx`
  - Exports/imports the new step if keeping step components together.
- Modify: `src/features/round1/showroom-intake-app.tsx`
  - Adds sixth step, loads active colors, handles rendering-preference updates separately from layout-critical updates, moves final actions to the new step, and computes rendering staleness from preference metadata.
- Modify: `src/features/round1/showroom-intake-app.test.tsx`
  - Covers sixth step labels and preference edits not clearing cabinet fill/snapshot.
- Modify: `src/features/round1/rendering-prompt.ts`
  - Accepts current rendering preferences and selected color item.
- Modify: `src/features/round1/rendering-prompt.test.ts`
  - Replaces hard-coded European medium-tone wood assertion with European/American/color prompt tests.
- Modify: `src/server/round1/rendering-service.ts`
  - Accepts resolved rendering preferences and stamps `basedOnRenderingPreferences`.
- Modify: `src/server/round1/rendering-service.test.ts`
  - Tests prompt forwarding and rendering metadata.
- Modify: `src/server/round1/round1-repository.ts`
  - Extends legacy local rendering type with `basedOnRenderingPreferences`.
- Modify: `src/server/platform/round1-postgres-repository.ts`
  - Saves rendering preference metadata columns.
- Modify: `src/server/platform/round1-postgres-repository.test.ts`
  - Tests render-history row mapping or input persistence helpers.
- Modify: `src/app/api/projects/[projectId]/round1/state/route.ts`
  - Persists rendering preferences as part of `showroomForm` through the existing schema.
- Modify: `src/app/api/projects/[projectId]/round1/renderings/route.ts`
  - Resolves current saved rendering preferences and selected active color before rendering.

## Task 1: Domain Schema, Defaults, And Snapshot Audit Copy

**Files:**
- Modify: `src/domain/round1/schemas.ts`
- Modify: `src/features/round1/showroom-intake-data.ts`
- Modify: `src/features/round1/snapshot.ts`
- Test: `src/domain/round1/round1-core.test.ts`
- Test: `src/features/round1/snapshot.test.ts`

- [ ] **Step 1: Write the failing schema/default tests**

Add these tests to `src/domain/round1/round1-core.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { round1FormSchema } from "./schemas";

describe("round1FormSchema rendering preferences", () => {
  test("accepts European and American rendering preferences", () => {
    const base = {
      room: { length: 180, width: 120, dimensionsKnown: true, ceilingHeight: null, obstacles: [] },
      openings: { doors: { status: "NO", items: [] }, windows: { status: "NO", items: [] } },
      mep: {
        water: { relation: "UNKNOWN", movable: "UNKNOWN" },
        gas: { relation: "UNKNOWN", movable: "UNKNOWN" },
        electric: { relation: "UNKNOWN", movable: "UNKNOWN" },
        vent: { relation: "UNKNOWN", movable: "UNKNOWN" }
      },
      layoutPreference: "LEFT_L_SHAPE",
      fixtures: {
        sink: { status: "YES", size: 33, type: "UNKNOWN", relation: "ON_MAIN_RUN" },
        range: { size: null, fuel: "GAS", fixedLocation: "UNKNOWN", relation: "BACK_SIDE" },
        fridge: { status: "YES", size: 36, type: "UNKNOWN", relation: "FRONT_SIDE" },
        dishwasher: { status: "YES", size: 24, relation: "NEAR_SINK" },
        hood: { relation: "ABOVE_RANGE" }
      },
      layoutSensitiveCabinets: {
        cornerCabinet: { preferredType: "NO_PREFERENCE" },
        ovenMicrowave: { configuration: "UNKNOWN", relation: "UNKNOWN" },
        cookingAppliances: {
          range: { status: "YES", relation: "BACK_SIDE" },
          cooktop: { status: "NO", relation: "NOT_APPLICABLE" },
          wallOven: { status: "NO", relation: "NOT_APPLICABLE" },
          microwaveOvenCombo: { status: "UNKNOWN", relation: "UNKNOWN" }
        },
        island: { status: "NO", requested: false, functions: [] }
      }
    };

    expect(
      round1FormSchema.parse({
        ...base,
        renderingPreferences: {
          cabinetStyle: "EUROPEAN_FRAMELESS",
          doorColorId: null
        }
      }).renderingPreferences
    ).toEqual({ cabinetStyle: "EUROPEAN_FRAMELESS", doorColorId: null });

    expect(
      round1FormSchema.parse({
        ...base,
        renderingPreferences: {
          cabinetStyle: "AMERICAN_FRAMED",
          doorColorId: "color-1"
        }
      }).renderingPreferences
    ).toEqual({ cabinetStyle: "AMERICAN_FRAMED", doorColorId: "color-1" });
  });
});
```

Add this test to `src/features/round1/snapshot.test.ts`:

```ts
test("copies rendering preferences into the snapshot audit context", () => {
  const form = createDefaultShowroomForm();
  form.renderingPreferences = {
    cabinetStyle: "AMERICAN_FRAMED",
    doorColorId: "painted-white"
  };
  const result = normalizeRound1Form(form);
  const estimate = generatePreliminaryCabinetList(createDefaultCabinetRuns(form));

  const snapshot = buildRound1Snapshot({
    showroomForm: form,
    normalized: result.normalized,
    positionOverrides: {},
    preliminaryCabinets: estimate,
    confirmationItems: [...result.confirmationItems, ...estimate.confirmationItems],
    readiness: result.readiness,
    now: () => new Date("2026-06-19T12:00:00.000Z")
  });

  expect(snapshot.showroomForm.renderingPreferences).toEqual({
    cabinetStyle: "AMERICAN_FRAMED",
    doorColorId: "painted-white"
  });
});
```

- [ ] **Step 2: Run the focused tests and verify they fail**

Run:

```bash
npm test -- src/domain/round1/round1-core.test.ts src/features/round1/snapshot.test.ts
```

Expected: FAIL because `renderingPreferences` is not in `round1FormSchema` or the default form.

- [ ] **Step 3: Add schema and default form fields**

In `src/domain/round1/schemas.ts`, add near the other shared schemas:

```ts
const cabinetStyleSchema = z.enum(["EUROPEAN_FRAMELESS", "AMERICAN_FRAMED"]);

const renderingPreferencesSchema = z.object({
  cabinetStyle: cabinetStyleSchema.default("EUROPEAN_FRAMELESS"),
  doorColorId: z.string().min(1).nullable().default(null)
});
```

Add this field at the top level of `round1FormSchema`:

```ts
renderingPreferences: renderingPreferencesSchema.default({
  cabinetStyle: "EUROPEAN_FRAMELESS",
  doorColorId: null
})
```

Export the inferred types at the bottom:

```ts
export type CabinetStyle = z.infer<typeof cabinetStyleSchema>;
export type Round1RenderingPreferences = z.infer<
  typeof renderingPreferencesSchema
>;
```

In `src/features/round1/showroom-intake-data.ts`, add to `createDefaultShowroomForm()`:

```ts
renderingPreferences: {
  cabinetStyle: "EUROPEAN_FRAMELESS",
  doorColorId: null
}
```

- [ ] **Step 4: Run focused tests and verify they pass**

Run:

```bash
npm test -- src/domain/round1/round1-core.test.ts src/features/round1/snapshot.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/domain/round1/schemas.ts src/features/round1/showroom-intake-data.ts src/features/round1/snapshot.ts src/domain/round1/round1-core.test.ts src/features/round1/snapshot.test.ts
git commit -m "feat(round1): add rendering preference schema"
```

## Task 2: Cabinet Color Library Database, Repository, And APIs

**Files:**
- Modify: `src/server/db/schema.sql`
- Modify: `src/server/db/schema.test.ts`
- Create: `src/server/platform/cabinet-color-repository.ts`
- Create: `src/server/platform/cabinet-color-repository.test.ts`
- Create: `src/app/api/cabinet-colors/route.ts`
- Create: `src/app/api/admin/cabinet-colors/route.ts`
- Create: `src/app/api/admin/cabinet-colors/[colorId]/route.ts`
- Create: `src/app/api/admin/cabinet-colors/route.test.ts`

- [ ] **Step 1: Write schema and repository tests**

Extend `src/server/db/schema.test.ts`:

```ts
test("defines cabinet color library and rendering preference metadata", () => {
  expect(schema).toContain("CREATE TABLE IF NOT EXISTS cabinet_colors");
  expect(schema).toContain("cabinet_style TEXT NOT NULL CHECK (cabinet_style IN ('EUROPEAN_FRAMELESS', 'AMERICAN_FRAMED'))");
  expect(schema).toContain("swatch_image_url TEXT");
  expect(schema).toContain("hover_example_image_url TEXT");
  expect(schema).toContain("prompt_description TEXT NOT NULL");
  expect(schema).toContain("based_on_cabinet_style TEXT");
  expect(schema).toContain("based_on_door_color_id UUID");
});
```

Create `src/server/platform/cabinet-color-repository.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import {
  cabinetColorInputSchema,
  isColorCompatibleWithStyle,
  mapCabinetColorRow,
  type CabinetColorRow
} from "./cabinet-color-repository";

const row: CabinetColorRow = {
  id: "11111111-1111-1111-1111-111111111111",
  company_id: "22222222-2222-2222-2222-222222222222",
  cabinet_style: "EUROPEAN_FRAMELESS",
  name: "Natural Oak Matte",
  color_code: "EU-101",
  swatch_image_url: "https://example.com/oak.jpg",
  swatch_hex: "#d8c8ad",
  hover_example_image_url: "https://example.com/oak-kitchen.jpg",
  prompt_description: "warm natural oak matte slab cabinet doors",
  active: true,
  sort_order: 10,
  created_at: new Date("2026-06-19T00:00:00.000Z"),
  updated_at: new Date("2026-06-19T00:01:00.000Z")
};

describe("cabinet color repository helpers", () => {
  test("maps database rows to API models", () => {
    expect(mapCabinetColorRow(row)).toEqual({
      id: row.id,
      companyId: row.company_id,
      cabinetStyle: "EUROPEAN_FRAMELESS",
      name: "Natural Oak Matte",
      colorCode: "EU-101",
      swatchImageUrl: "https://example.com/oak.jpg",
      swatchHex: "#d8c8ad",
      hoverExampleImageUrl: "https://example.com/oak-kitchen.jpg",
      promptDescription: "warm natural oak matte slab cabinet doors",
      active: true,
      sortOrder: 10,
      createdAt: "2026-06-19T00:00:00.000Z",
      updatedAt: "2026-06-19T00:01:00.000Z"
    });
  });

  test("validates cabinet color input", () => {
    const input = cabinetColorInputSchema.parse({
      cabinetStyle: "AMERICAN_FRAMED",
      name: "Painted White",
      colorCode: "US-201",
      swatchImageUrl: "https://example.com/white.jpg",
      swatchHex: "#f4f1e8",
      hoverExampleImageUrl: "",
      promptDescription: "painted soft white framed cabinet doors",
      active: true,
      sortOrder: 2
    });

    expect(input.hoverExampleImageUrl).toBeNull();
    expect(input.cabinetStyle).toBe("AMERICAN_FRAMED");
  });

  test("checks color/style compatibility", () => {
    expect(isColorCompatibleWithStyle(mapCabinetColorRow(row), "EUROPEAN_FRAMELESS")).toBe(true);
    expect(isColorCompatibleWithStyle(mapCabinetColorRow(row), "AMERICAN_FRAMED")).toBe(false);
  });
});
```

Create `src/app/api/admin/cabinet-colors/route.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { parseCabinetColorRequest } from "./route";

describe("admin cabinet color route helpers", () => {
  test("parses create requests", () => {
    expect(
      parseCabinetColorRequest({
        cabinetStyle: "EUROPEAN_FRAMELESS",
        name: "Natural Oak Matte",
        colorCode: "EU-101",
        swatchImageUrl: "https://example.com/oak.jpg",
        swatchHex: "#d8c8ad",
        hoverExampleImageUrl: "https://example.com/example.jpg",
        promptDescription: "warm natural oak matte slab cabinet doors",
        active: true,
        sortOrder: 1
      })
    ).toMatchObject({
      cabinetStyle: "EUROPEAN_FRAMELESS",
      name: "Natural Oak Matte",
      active: true
    });
  });
});
```

- [ ] **Step 2: Run focused tests and verify they fail**

Run:

```bash
npm test -- src/server/db/schema.test.ts src/server/platform/cabinet-color-repository.test.ts src/app/api/admin/cabinet-colors/route.test.ts
```

Expected: FAIL because repository and routes do not exist and schema lacks the table.

- [ ] **Step 3: Add database schema**

Append to `src/server/db/schema.sql` before the indexes:

```sql
CREATE TABLE IF NOT EXISTS cabinet_colors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  cabinet_style TEXT NOT NULL CHECK (cabinet_style IN ('EUROPEAN_FRAMELESS', 'AMERICAN_FRAMED')),
  name TEXT NOT NULL,
  color_code TEXT,
  swatch_image_url TEXT,
  swatch_hex TEXT,
  hover_example_image_url TEXT,
  prompt_description TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Add rendering preference metadata columns to the `renderings` table:

```sql
  based_on_cabinet_style TEXT CHECK (based_on_cabinet_style IN ('EUROPEAN_FRAMELESS', 'AMERICAN_FRAMED')),
  based_on_door_color_id UUID,
  based_on_color_updated_at TIMESTAMPTZ,
```

Place those columns after `based_on_snapshot_generated_at TIMESTAMPTZ NOT NULL,`.

Add indexes:

```sql
CREATE INDEX IF NOT EXISTS cabinet_colors_company_style_idx ON cabinet_colors(company_id, cabinet_style, active, sort_order);
```

- [ ] **Step 4: Create repository**

Create `src/server/platform/cabinet-color-repository.ts`:

```ts
import { z } from "zod";
import { query } from "@/server/db/client";
import type { CabinetStyle } from "@/domain/round1";

const nullableUrl = z
  .union([z.string().trim().url(), z.literal("")])
  .transform((value) => (value ? value : null))
  .nullable()
  .optional()
  .transform((value) => value ?? null);

export const cabinetColorInputSchema = z.object({
  cabinetStyle: z.enum(["EUROPEAN_FRAMELESS", "AMERICAN_FRAMED"]),
  name: z.string().trim().min(1),
  colorCode: z.string().trim().nullable().optional().transform((value) => value || null),
  swatchImageUrl: nullableUrl,
  swatchHex: z.string().trim().nullable().optional().transform((value) => value || null),
  hoverExampleImageUrl: nullableUrl,
  promptDescription: z.string().trim().min(1),
  active: z.boolean().default(true),
  sortOrder: z.number().int().default(0)
});

export type CabinetColorInput = z.infer<typeof cabinetColorInputSchema>;

export type CabinetColorRow = {
  id: string;
  company_id: string;
  cabinet_style: CabinetStyle;
  name: string;
  color_code: string | null;
  swatch_image_url: string | null;
  swatch_hex: string | null;
  hover_example_image_url: string | null;
  prompt_description: string;
  active: boolean;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
};

export type CabinetColor = {
  id: string;
  companyId: string;
  cabinetStyle: CabinetStyle;
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

export function mapCabinetColorRow(row: CabinetColorRow): CabinetColor {
  return {
    id: row.id,
    companyId: row.company_id,
    cabinetStyle: row.cabinet_style,
    name: row.name,
    colorCode: row.color_code,
    swatchImageUrl: row.swatch_image_url,
    swatchHex: row.swatch_hex,
    hoverExampleImageUrl: row.hover_example_image_url,
    promptDescription: row.prompt_description,
    active: row.active,
    sortOrder: row.sort_order,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  };
}

export function isColorCompatibleWithStyle(
  color: CabinetColor | null,
  cabinetStyle: CabinetStyle
) {
  return Boolean(color && color.active && color.cabinetStyle === cabinetStyle);
}

export async function listCabinetColors(companyId: string, activeOnly = false) {
  const result = await query<CabinetColorRow>(
    `SELECT id, company_id, cabinet_style, name, color_code, swatch_image_url,
            swatch_hex, hover_example_image_url, prompt_description, active,
            sort_order, created_at, updated_at
     FROM cabinet_colors
     WHERE company_id = $1 AND ($2::boolean = false OR active = true)
     ORDER BY cabinet_style ASC, sort_order ASC, name ASC`,
    [companyId, activeOnly]
  );
  return result.rows.map(mapCabinetColorRow);
}

export async function getCabinetColor(companyId: string, colorId: string) {
  const result = await query<CabinetColorRow>(
    `SELECT id, company_id, cabinet_style, name, color_code, swatch_image_url,
            swatch_hex, hover_example_image_url, prompt_description, active,
            sort_order, created_at, updated_at
     FROM cabinet_colors
     WHERE company_id = $1 AND id = $2`,
    [companyId, colorId]
  );
  return result.rows[0] ? mapCabinetColorRow(result.rows[0]) : null;
}

export async function createCabinetColor(companyId: string, input: CabinetColorInput) {
  const result = await query<CabinetColorRow>(
    `INSERT INTO cabinet_colors (
       company_id, cabinet_style, name, color_code, swatch_image_url,
       swatch_hex, hover_example_image_url, prompt_description, active, sort_order
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING id, company_id, cabinet_style, name, color_code, swatch_image_url,
               swatch_hex, hover_example_image_url, prompt_description, active,
               sort_order, created_at, updated_at`,
    [
      companyId,
      input.cabinetStyle,
      input.name,
      input.colorCode,
      input.swatchImageUrl,
      input.swatchHex,
      input.hoverExampleImageUrl,
      input.promptDescription,
      input.active,
      input.sortOrder
    ]
  );
  return mapCabinetColorRow(result.rows[0]);
}

export async function updateCabinetColor(companyId: string, colorId: string, input: CabinetColorInput) {
  const result = await query<CabinetColorRow>(
    `UPDATE cabinet_colors SET
       cabinet_style = $3,
       name = $4,
       color_code = $5,
       swatch_image_url = $6,
       swatch_hex = $7,
       hover_example_image_url = $8,
       prompt_description = $9,
       active = $10,
       sort_order = $11,
       updated_at = now()
     WHERE company_id = $1 AND id = $2
     RETURNING id, company_id, cabinet_style, name, color_code, swatch_image_url,
               swatch_hex, hover_example_image_url, prompt_description, active,
               sort_order, created_at, updated_at`,
    [
      companyId,
      colorId,
      input.cabinetStyle,
      input.name,
      input.colorCode,
      input.swatchImageUrl,
      input.swatchHex,
      input.hoverExampleImageUrl,
      input.promptDescription,
      input.active,
      input.sortOrder
    ]
  );
  return result.rows[0] ? mapCabinetColorRow(result.rows[0]) : null;
}
```

- [ ] **Step 5: Add API routes**

Create `src/app/api/cabinet-colors/route.ts`:

```ts
import { NextResponse } from "next/server";
import { requireUser } from "@/server/platform/auth-service";
import { listCabinetColors } from "@/server/platform/cabinet-color-repository";

export async function GET() {
  const user = await requireUser();
  return NextResponse.json({
    colors: await listCabinetColors(user.companyId, true)
  });
}
```

Create `src/app/api/admin/cabinet-colors/route.ts`:

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { ForbiddenError, requireRole, requireUser, UnauthorizedError } from "@/server/platform/auth-service";
import { cabinetColorInputSchema, createCabinetColor, listCabinetColors } from "@/server/platform/cabinet-color-repository";

export function parseCabinetColorRequest(value: unknown) {
  return cabinetColorInputSchema.parse(value);
}

function authError(error: unknown) {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  if (error instanceof ForbiddenError) {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }
  return null;
}

export async function GET() {
  try {
    const user = await requireUser();
    requireRole(user, ["ADMIN"]);
    return NextResponse.json({ colors: await listCabinetColors(user.companyId, false) });
  } catch (error) {
    return authError(error) ?? NextResponse.json({ error: "Unable to list cabinet colors" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    requireRole(user, ["ADMIN"]);
    const input = parseCabinetColorRequest(await request.json());
    return NextResponse.json({ color: await createCabinetColor(user.companyId, input) }, { status: 201 });
  } catch (error) {
    const auth = authError(error);
    if (auth) return auth;
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid cabinet color request", issues: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Unable to create cabinet color" }, { status: 500 });
  }
}
```

Create `src/app/api/admin/cabinet-colors/[colorId]/route.ts`:

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { ForbiddenError, requireRole, requireUser, UnauthorizedError } from "@/server/platform/auth-service";
import { cabinetColorInputSchema, updateCabinetColor } from "@/server/platform/cabinet-color-repository";

function authError(error: unknown) {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  if (error instanceof ForbiddenError) {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }
  return null;
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ colorId: string }> }
) {
  try {
    const user = await requireUser();
    requireRole(user, ["ADMIN"]);
    const { colorId } = await params;
    const input = cabinetColorInputSchema.parse(await request.json());
    const color = await updateCabinetColor(user.companyId, colorId, input);
    if (!color) return NextResponse.json({ error: "Cabinet color not found" }, { status: 404 });
    return NextResponse.json({ color });
  } catch (error) {
    const auth = authError(error);
    if (auth) return auth;
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid cabinet color request", issues: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Unable to update cabinet color" }, { status: 500 });
  }
}
```

- [ ] **Step 6: Run focused tests and verify they pass**

Run:

```bash
npm test -- src/server/db/schema.test.ts src/server/platform/cabinet-color-repository.test.ts src/app/api/admin/cabinet-colors/route.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```bash
git add src/server/db/schema.sql src/server/db/schema.test.ts src/server/platform/cabinet-color-repository.ts src/server/platform/cabinet-color-repository.test.ts src/app/api/cabinet-colors/route.ts src/app/api/admin/cabinet-colors/route.ts 'src/app/api/admin/cabinet-colors/[colorId]/route.ts' src/app/api/admin/cabinet-colors/route.test.ts
git commit -m "feat(platform): add cabinet color library APIs"
```

## Task 3: Admin Cabinet Color Management UI

**Files:**
- Create: `src/features/platform/cabinet-color-form.tsx`
- Create: `src/features/platform/cabinet-color-form.test.tsx`
- Create: `src/features/platform/cabinet-colors-admin-view.tsx`
- Create: `src/app/admin/cabinet-colors/page.tsx`
- Modify: `src/features/platform/project-dashboard.tsx`

- [ ] **Step 1: Write Admin UI tests**

Create `src/features/platform/cabinet-color-form.test.tsx`:

```ts
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { CabinetColorForm, buildCabinetColorPayload } from "./cabinet-color-form";

describe("CabinetColorForm", () => {
  test("renders fields needed to configure swatches and hover examples", () => {
    const html = renderToStaticMarkup(<CabinetColorForm />);

    expect(html).toContain("Cabinet style");
    expect(html).toContain("Color name");
    expect(html).toContain("Swatch image URL");
    expect(html).toContain("Hover example image URL");
    expect(html).toContain("Prompt description");
  });

  test("builds the API payload", () => {
    const formData = new FormData();
    formData.set("cabinetStyle", "EUROPEAN_FRAMELESS");
    formData.set("name", "Natural Oak Matte");
    formData.set("colorCode", "EU-101");
    formData.set("swatchImageUrl", "https://example.com/oak.jpg");
    formData.set("swatchHex", "#d8c8ad");
    formData.set("hoverExampleImageUrl", "https://example.com/example.jpg");
    formData.set("promptDescription", "warm natural oak matte slab cabinet doors");
    formData.set("active", "on");
    formData.set("sortOrder", "3");

    expect(buildCabinetColorPayload(formData)).toEqual({
      cabinetStyle: "EUROPEAN_FRAMELESS",
      name: "Natural Oak Matte",
      colorCode: "EU-101",
      swatchImageUrl: "https://example.com/oak.jpg",
      swatchHex: "#d8c8ad",
      hoverExampleImageUrl: "https://example.com/example.jpg",
      promptDescription: "warm natural oak matte slab cabinet doors",
      active: true,
      sortOrder: 3
    });
  });
});
```

- [ ] **Step 2: Run focused test and verify it fails**

Run:

```bash
npm test -- src/features/platform/cabinet-color-form.test.tsx
```

Expected: FAIL because the form module does not exist.

- [ ] **Step 3: Create client form**

Create `src/features/platform/cabinet-color-form.tsx`:

```tsx
"use client";

import { useState } from "react";
import type { CabinetColor } from "@/server/platform/cabinet-color-repository";

const STYLES = [
  { value: "EUROPEAN_FRAMELESS", label: "European Frameless" },
  { value: "AMERICAN_FRAMED", label: "American Framed" }
] as const;

export function buildCabinetColorPayload(formData: FormData) {
  return {
    cabinetStyle: String(formData.get("cabinetStyle")),
    name: String(formData.get("name") ?? "").trim(),
    colorCode: String(formData.get("colorCode") ?? "").trim() || null,
    swatchImageUrl: String(formData.get("swatchImageUrl") ?? "").trim() || null,
    swatchHex: String(formData.get("swatchHex") ?? "").trim() || null,
    hoverExampleImageUrl: String(formData.get("hoverExampleImageUrl") ?? "").trim() || null,
    promptDescription: String(formData.get("promptDescription") ?? "").trim(),
    active: formData.get("active") === "on",
    sortOrder: Number(String(formData.get("sortOrder") ?? "0")) || 0
  };
}

export function CabinetColorForm({ color }: { color?: CabinetColor }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const payload = buildCabinetColorPayload(new FormData(event.currentTarget));
    const response = await fetch(
      color ? `/api/admin/cabinet-colors/${color.id}` : "/api/admin/cabinet-colors",
      {
        method: color ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }
    );
    if (!response.ok) {
      setBusy(false);
      setError("Unable to save cabinet color. Check the fields and try again.");
      return;
    }
    window.location.reload();
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded border border-stone-300 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold">{color ? "Edit color" : "Add color"}</h2>
      <label className="block text-sm font-medium">
        Cabinet style
        <select name="cabinetStyle" defaultValue={color?.cabinetStyle ?? "EUROPEAN_FRAMELESS"} className="mt-1 w-full rounded border border-stone-300 px-3 py-2">
          {STYLES.map((style) => (
            <option key={style.value} value={style.value}>{style.label}</option>
          ))}
        </select>
      </label>
      <label className="block text-sm font-medium">
        Color name
        <input name="name" defaultValue={color?.name ?? ""} className="mt-1 w-full rounded border border-stone-300 px-3 py-2" />
      </label>
      <label className="block text-sm font-medium">
        Color code
        <input name="colorCode" defaultValue={color?.colorCode ?? ""} className="mt-1 w-full rounded border border-stone-300 px-3 py-2" />
      </label>
      <label className="block text-sm font-medium">
        Swatch image URL
        <input name="swatchImageUrl" defaultValue={color?.swatchImageUrl ?? ""} className="mt-1 w-full rounded border border-stone-300 px-3 py-2" />
      </label>
      <label className="block text-sm font-medium">
        Fallback HEX
        <input name="swatchHex" defaultValue={color?.swatchHex ?? ""} placeholder="#d8c8ad" className="mt-1 w-full rounded border border-stone-300 px-3 py-2" />
      </label>
      <label className="block text-sm font-medium">
        Hover example image URL
        <input name="hoverExampleImageUrl" defaultValue={color?.hoverExampleImageUrl ?? ""} className="mt-1 w-full rounded border border-stone-300 px-3 py-2" />
      </label>
      <label className="block text-sm font-medium">
        Prompt description
        <textarea name="promptDescription" defaultValue={color?.promptDescription ?? ""} rows={3} className="mt-1 w-full rounded border border-stone-300 px-3 py-2" />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm font-medium">
          Sort order
          <input name="sortOrder" type="number" defaultValue={color?.sortOrder ?? 0} className="mt-1 w-full rounded border border-stone-300 px-3 py-2" />
        </label>
        <label className="mt-7 flex items-center gap-2 text-sm font-medium">
          <input name="active" type="checkbox" defaultChecked={color?.active ?? true} />
          Active
        </label>
      </div>
      {error && <p className="text-sm text-red-700">{error}</p>}
      <button disabled={busy} className="w-full rounded bg-stone-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
        {busy ? "Saving..." : "Save color"}
      </button>
    </form>
  );
}
```

- [ ] **Step 4: Create Admin view and page**

Create `src/features/platform/cabinet-colors-admin-view.tsx`:

```tsx
import Link from "next/link";
import type { CabinetColor } from "@/server/platform/cabinet-color-repository";
import { CabinetColorForm } from "./cabinet-color-form";

const STYLE_LABELS = {
  EUROPEAN_FRAMELESS: "European Frameless",
  AMERICAN_FRAMED: "American Framed"
} as const;

export function CabinetColorsAdminView({ colors }: { colors: CabinetColor[] }) {
  return (
    <main className="min-h-screen bg-stone-100 px-6 py-8 text-stone-950">
      <div className="mx-auto max-w-6xl">
        <Link href="/projects" className="text-sm text-stone-600">Back to projects</Link>
        <h1 className="mt-4 text-2xl font-semibold">Cabinet Colors</h1>
        <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-6">
            {(["EUROPEAN_FRAMELESS", "AMERICAN_FRAMED"] as const).map((style) => {
              const group = colors.filter((color) => color.cabinetStyle === style);
              return (
                <section key={style} className="rounded border border-stone-300 bg-white">
                  <h2 className="border-b border-stone-200 px-4 py-3 text-lg font-semibold">{STYLE_LABELS[style]}</h2>
                  <div className="grid gap-3 p-4 md:grid-cols-2">
                    {group.map((color) => (
                      <article key={color.id} className="rounded border border-stone-200 p-3">
                        <div className="aspect-square overflow-hidden rounded border border-stone-200 bg-stone-100">
                          {color.swatchImageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={color.swatchImageUrl} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <div className="h-full w-full" style={{ background: color.swatchHex ?? "#e7e5e4" }} />
                          )}
                        </div>
                        <div className="mt-3 flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold">{color.name}</p>
                            <p className="text-sm text-stone-500">{color.colorCode ?? "No code"}</p>
                          </div>
                          <span className={`rounded px-2 py-1 text-xs font-semibold ${color.active ? "bg-emerald-50 text-emerald-700" : "bg-stone-100 text-stone-500"}`}>
                            {color.active ? "Active" : "Inactive"}
                          </span>
                        </div>
                        <details className="mt-3">
                          <summary className="cursor-pointer text-sm font-medium text-stone-700">Edit</summary>
                          <div className="mt-3">
                            <CabinetColorForm color={color} />
                          </div>
                        </details>
                      </article>
                    ))}
                    {group.length === 0 && <p className="text-sm text-stone-600">No colors configured.</p>}
                  </div>
                </section>
              );
            })}
          </div>
          <CabinetColorForm />
        </section>
      </div>
    </main>
  );
}
```

Create `src/app/admin/cabinet-colors/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { CabinetColorsAdminView } from "@/features/platform/cabinet-colors-admin-view";
import { getCurrentUser } from "@/server/platform/auth-service";
import { listCabinetColors } from "@/server/platform/cabinet-color-repository";

export default async function AdminCabinetColorsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/projects");
  const colors = await listCabinetColors(user.companyId, false);
  return <CabinetColorsAdminView colors={colors} />;
}
```

In `src/features/platform/project-dashboard.tsx`, add this Admin link next to `Users`:

```tsx
{user.role === "ADMIN" && (
  <Link href="/admin/cabinet-colors" className="rounded border border-stone-300 px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100">
    Cabinet Colors
  </Link>
)}
```

- [ ] **Step 5: Run tests**

Run:

```bash
npm test -- src/features/platform/cabinet-color-form.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add src/features/platform/cabinet-color-form.tsx src/features/platform/cabinet-color-form.test.tsx src/features/platform/cabinet-colors-admin-view.tsx src/app/admin/cabinet-colors/page.tsx src/features/platform/project-dashboard.tsx
git commit -m "feat(admin): manage cabinet color libraries"
```

## Task 4: Sales Rendering Preferences Step

**Files:**
- Create: `src/features/round1/rendering-preferences.ts`
- Create: `src/features/round1/rendering-preferences-step.tsx`
- Create: `src/features/round1/rendering-preferences-step.test.tsx`
- Modify: `src/features/round1/showroom-intake-app.tsx`
- Modify: `src/features/round1/showroom-intake-app.test.tsx`
- Modify: `src/features/round1/showroom-intake-panels.tsx`

- [ ] **Step 1: Write step tests**

Create `src/features/round1/rendering-preferences-step.test.tsx`:

```ts
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { createDefaultShowroomForm } from "./showroom-intake-data";
import { RenderingPreferencesStep } from "./rendering-preferences-step";
import type { CabinetColor } from "@/server/platform/cabinet-color-repository";

const colors: CabinetColor[] = [
  {
    id: "eu-oak",
    companyId: "company",
    cabinetStyle: "EUROPEAN_FRAMELESS",
    name: "Natural Oak Matte",
    colorCode: "EU-101",
    swatchImageUrl: "https://example.com/oak.jpg",
    swatchHex: "#d8c8ad",
    hoverExampleImageUrl: "https://example.com/oak-kitchen.jpg",
    promptDescription: "warm natural oak matte slab cabinet doors",
    active: true,
    sortOrder: 1,
    createdAt: "2026-06-19T00:00:00.000Z",
    updatedAt: "2026-06-19T00:00:00.000Z"
  },
  {
    id: "us-white",
    companyId: "company",
    cabinetStyle: "AMERICAN_FRAMED",
    name: "Painted White",
    colorCode: "US-201",
    swatchImageUrl: "https://example.com/white.jpg",
    swatchHex: "#f4f1e8",
    hoverExampleImageUrl: null,
    promptDescription: "painted soft white framed cabinet doors",
    active: true,
    sortOrder: 1,
    createdAt: "2026-06-19T00:00:00.000Z",
    updatedAt: "2026-06-19T00:00:00.000Z"
  }
];

describe("RenderingPreferencesStep", () => {
  test("shows large color board for the selected style only", () => {
    const form = createDefaultShowroomForm();
    const html = renderToStaticMarkup(
      <RenderingPreferencesStep
        form={form}
        colors={colors}
        onFormChange={() => {}}
        onGenerateCabinetFill={() => {}}
        onGenerateRendering={() => {}}
        canGenerateCabinetFill
        canGenerateRendering={false}
        renderingBusy={false}
      />
    );

    expect(html).toContain("Natural Oak Matte");
    expect(html).not.toContain("Painted White");
    expect(html).toContain("Confirm Color");
  });

  test("shows an admin setup message when no active colors exist", () => {
    const html = renderToStaticMarkup(
      <RenderingPreferencesStep
        form={createDefaultShowroomForm()}
        colors={[]}
        onFormChange={() => {}}
        onGenerateCabinetFill={() => {}}
        onGenerateRendering={() => {}}
        canGenerateCabinetFill={false}
        canGenerateRendering={false}
        renderingBusy={false}
      />
    );

    expect(html).toContain("Ask an Admin to configure cabinet colors");
  });
});
```

Add to `src/features/round1/showroom-intake-app.test.tsx`:

```ts
test("includes Rendering Preferences as the sixth showroom step", () => {
  const html = renderToStaticMarkup(<ShowroomIntakeApp />);
  expect(html).toContain("Rendering Preferences");
});
```

- [ ] **Step 2: Run focused tests and verify they fail**

Run:

```bash
npm test -- src/features/round1/rendering-preferences-step.test.tsx src/features/round1/showroom-intake-app.test.tsx
```

Expected: FAIL because the new step does not exist and the app has only five steps.

- [ ] **Step 3: Create shared rendering preference helpers**

Create `src/features/round1/rendering-preferences.ts`:

```ts
import type { CabinetStyle, Round1FormInput } from "@/domain/round1";
import type { CabinetColor } from "@/server/platform/cabinet-color-repository";

export const CABINET_STYLE_LABELS: Record<CabinetStyle, string> = {
  EUROPEAN_FRAMELESS: "European Frameless",
  AMERICAN_FRAMED: "American Framed"
};

export function activeColorsForStyle(colors: CabinetColor[], style: CabinetStyle) {
  return colors
    .filter((color) => color.active && color.cabinetStyle === style)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

export function selectedRenderingColor(
  colors: CabinetColor[],
  form: Round1FormInput
) {
  const id = form.renderingPreferences.doorColorId;
  if (!id) return null;
  return colors.find((color) => color.id === id) ?? null;
}

export function renderingPreferencesComplete(
  colors: CabinetColor[],
  form: Round1FormInput
) {
  const color = selectedRenderingColor(colors, form);
  return Boolean(
    color &&
      color.active &&
      color.cabinetStyle === form.renderingPreferences.cabinetStyle
  );
}
```

- [ ] **Step 4: Create Sales step component**

Create `src/features/round1/rendering-preferences-step.tsx`:

```tsx
"use client";

import { useMemo, useState } from "react";
import type { CabinetStyle, Round1FormInput } from "@/domain/round1";
import type { CabinetColor } from "@/server/platform/cabinet-color-repository";
import { CABINET_STYLE_LABELS, activeColorsForStyle, renderingPreferencesComplete } from "./rendering-preferences";
import { Step } from "./showroom-intake-controls";

export function RenderingPreferencesStep({
  form,
  colors,
  onFormChange,
  onGenerateCabinetFill,
  onGenerateRendering,
  canGenerateCabinetFill,
  canGenerateRendering,
  renderingBusy
}: {
  form: Round1FormInput;
  colors: CabinetColor[];
  onFormChange: (form: Round1FormInput) => void;
  onGenerateCabinetFill: () => void;
  onGenerateRendering: () => void;
  canGenerateCabinetFill: boolean;
  canGenerateRendering: boolean;
  renderingBusy: boolean;
}) {
  const [pendingColor, setPendingColor] = useState<CabinetColor | null>(null);
  const [hoveredColor, setHoveredColor] = useState<CabinetColor | null>(null);
  const style = form.renderingPreferences.cabinetStyle;
  const styleColors = useMemo(() => activeColorsForStyle(colors, style), [colors, style]);
  const isComplete = renderingPreferencesComplete(colors, form);

  function setStyle(cabinetStyle: CabinetStyle) {
    const current = colors.find((color) => color.id === form.renderingPreferences.doorColorId);
    onFormChange({
      ...form,
      renderingPreferences: {
        cabinetStyle,
        doorColorId: current?.cabinetStyle === cabinetStyle ? current.id : null
      }
    });
  }

  return (
    <Step title="6. Rendering Preferences">
      <div className="space-y-5">
        <div className="flex flex-wrap gap-2">
          {(["EUROPEAN_FRAMELESS", "AMERICAN_FRAMED"] as CabinetStyle[]).map((cabinetStyle) => (
            <button
              key={cabinetStyle}
              type="button"
              onClick={() => setStyle(cabinetStyle)}
              className={`rounded-md border px-4 py-2 text-sm font-bold ${style === cabinetStyle ? "border-sky-700 bg-sky-700 text-white" : "border-slate-300 bg-white text-slate-700"}`}
            >
              {CABINET_STYLE_LABELS[cabinetStyle]}
            </button>
          ))}
        </div>

        {styleColors.length === 0 ? (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-sm font-bold text-amber-800">
            Ask an Admin to configure cabinet colors for {CABINET_STYLE_LABELS[style]}.
          </p>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {styleColors.map((color) => (
                <button
                  key={color.id}
                  type="button"
                  onMouseEnter={() => setHoveredColor(color)}
                  onFocus={() => setHoveredColor(color)}
                  onClick={() => setPendingColor(color)}
                  className={`rounded-lg border bg-white p-2 text-left ${form.renderingPreferences.doorColorId === color.id ? "border-slate-950 ring-2 ring-slate-950" : "border-slate-200"}`}
                >
                  <span className="block aspect-square overflow-hidden rounded-md border border-slate-200 bg-slate-100">
                    {color.swatchImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={color.swatchImageUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="block h-full w-full" style={{ background: color.swatchHex ?? "#e5e7eb" }} />
                    )}
                  </span>
                  <span className="mt-2 block text-sm font-black text-slate-950">{color.name}</span>
                  {color.colorCode && <span className="block text-xs font-bold text-slate-500">{color.colorCode}</span>}
                </button>
              ))}
            </div>
            <aside className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-xs font-black uppercase tracking-wide text-sky-700">Hover Example</p>
              {hoveredColor?.hoverExampleImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={hoveredColor.hoverExampleImageUrl} alt="" className="mt-3 aspect-[4/3] w-full rounded-md object-cover" />
              ) : (
                <div className="mt-3 flex aspect-[4/3] items-center justify-center rounded-md bg-slate-100 text-center text-xs font-bold text-slate-500">
                  Hover a color to view its reference example.
                </div>
              )}
              <p className="mt-3 text-sm font-bold text-slate-950">{hoveredColor?.name ?? "No color hovered"}</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">Reference only. The generated rendering still follows the locked Round 1 layout.</p>
            </aside>
          </div>
        )}

        <div className="flex flex-wrap gap-3 border-t border-slate-200 pt-4">
          <button type="button" onClick={onGenerateCabinetFill} disabled={!canGenerateCabinetFill} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-bold disabled:opacity-50">
            Generate Cabinet Fill
          </button>
          <button type="button" onClick={onGenerateRendering} disabled={!canGenerateRendering || renderingBusy || !isComplete} className="rounded-md bg-sky-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
            {renderingBusy ? "Generating Rendering..." : "Generate Rendering"}
          </button>
        </div>
      </div>

      {pendingColor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4">
          <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl">
            <h2 className="text-lg font-black">Confirm {pendingColor.name}?</h2>
            <div className="mt-3 aspect-square overflow-hidden rounded-md border border-slate-200 bg-slate-100">
              {pendingColor.swatchImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={pendingColor.swatchImageUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full" style={{ background: pendingColor.swatchHex ?? "#e5e7eb" }} />
              )}
            </div>
            <p className="mt-3 text-sm text-slate-600">This color will be used for the customer concept rendering only.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setPendingColor(null)} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-bold">Cancel</button>
              <button
                type="button"
                onClick={() => {
                  onFormChange({
                    ...form,
                    renderingPreferences: {
                      ...form.renderingPreferences,
                      doorColorId: pendingColor.id
                    }
                  });
                  setPendingColor(null);
                }}
                className="rounded-md bg-sky-700 px-4 py-2 text-sm font-bold text-white"
              >
                Confirm Color
              </button>
            </div>
          </div>
        </div>
      )}
    </Step>
  );
}
```

- [ ] **Step 5: Wire step into app**

In `src/features/round1/showroom-intake-app.tsx`:

1. Add `"Rendering Preferences"` to `SHOWROOM_STEPS`.
2. Add state for `cabinetColors`.
3. Fetch `/api/cabinet-colors` on mount and store `colors`.
4. Add `updateRenderingPreferencesForm(next)` that updates `form`, does not clear `snapshot`, does not clear `cabinetFillGenerated`, and sets rendering stale by leaving `renderingImage` in place while preference comparison changes.
5. Render `<RenderingPreferencesStep />` at the new final index.
6. Keep `AdjustPositionsStep` focused on confirm/reset positions. Remove or disable `onGenerateCabinetFill` from that step if the final action is fully moved.

Use this import:

```ts
import { RenderingPreferencesStep } from "./rendering-preferences-step";
import { renderingPreferencesComplete } from "./rendering-preferences";
import type { CabinetColor } from "@/server/platform/cabinet-color-repository";
```

Use this state:

```ts
const [cabinetColors, setCabinetColors] = useState<CabinetColor[]>([]);
```

Use this fetch effect:

```ts
useEffect(() => {
  let cancelled = false;
  (async () => {
    const response = await fetch("/api/cabinet-colors");
    if (!response.ok || cancelled) return;
    const json = await response.json();
    setCabinetColors(json.colors ?? []);
  })();
  return () => {
    cancelled = true;
  };
}, []);
```

Use this update handler:

```ts
const updateRenderingPreferencesForm = useCallback((next: Round1FormInput) => {
  localSessionChangedRef.current = true;
  setForm(next);
  setRenderingError(null);
}, []);
```

Pass this rendering gate:

```ts
const canGenerateRendering =
  persistState === "saved" && renderingPreferencesComplete(cabinetColors, form);
```

- [ ] **Step 6: Run focused tests**

Run:

```bash
npm test -- src/features/round1/rendering-preferences-step.test.tsx src/features/round1/showroom-intake-app.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```bash
git add src/features/round1/rendering-preferences.ts src/features/round1/rendering-preferences-step.tsx src/features/round1/rendering-preferences-step.test.tsx src/features/round1/showroom-intake-app.tsx src/features/round1/showroom-intake-app.test.tsx src/features/round1/showroom-intake-panels.tsx
git commit -m "feat(round1): add rendering preferences step"
```

## Task 5: Rendering Prompt, Service, And History Metadata

**Files:**
- Modify: `src/features/round1/rendering-prompt.ts`
- Modify: `src/features/round1/rendering-prompt.test.ts`
- Modify: `src/server/round1/rendering-service.ts`
- Modify: `src/server/round1/rendering-service.test.ts`
- Modify: `src/server/round1/round1-repository.ts`
- Modify: `src/server/platform/round1-postgres-repository.ts`
- Modify: `src/server/platform/round1-postgres-repository.test.ts`
- Modify: `src/app/api/projects/[projectId]/round1/renderings/route.ts`

- [ ] **Step 1: Write prompt/service tests**

In `src/features/round1/rendering-prompt.test.ts`, replace the hard-coded style test with:

```ts
test("uses European frameless style and selected color prompt description", () => {
  const prompt = buildRound1RenderingPrompt(buildSnapshot(), {
    cabinetStyle: "EUROPEAN_FRAMELESS",
    color: {
      id: "eu-oak",
      companyId: "company",
      cabinetStyle: "EUROPEAN_FRAMELESS",
      name: "Natural Oak Matte",
      colorCode: "EU-101",
      swatchImageUrl: "https://example.com/oak.jpg",
      swatchHex: "#d8c8ad",
      hoverExampleImageUrl: "https://example.com/oak-kitchen.jpg",
      promptDescription: "warm natural oak matte slab cabinet doors",
      active: true,
      sortOrder: 1,
      createdAt: "2026-06-19T00:00:00.000Z",
      updatedAt: "2026-06-19T00:00:00.000Z"
    }
  });

  expect(prompt).toContain("modern frameless European-style cabinetry");
  expect(prompt).toContain("warm natural oak matte slab cabinet doors");
  expect(prompt).not.toContain("medium-tone wood grain");
});

test("uses American framed style and selected color prompt description", () => {
  const prompt = buildRound1RenderingPrompt(buildSnapshot(), {
    cabinetStyle: "AMERICAN_FRAMED",
    color: {
      id: "us-white",
      companyId: "company",
      cabinetStyle: "AMERICAN_FRAMED",
      name: "Painted White",
      colorCode: "US-201",
      swatchImageUrl: "https://example.com/white.jpg",
      swatchHex: "#f4f1e8",
      hoverExampleImageUrl: null,
      promptDescription: "painted soft white framed cabinet doors",
      active: true,
      sortOrder: 1,
      createdAt: "2026-06-19T00:00:00.000Z",
      updatedAt: "2026-06-19T00:00:00.000Z"
    }
  });

  expect(prompt).toContain("American framed cabinetry");
  expect(prompt).toContain("painted soft white framed cabinet doors");
  expect(prompt).not.toContain("modern frameless European-style cabinetry");
});
```

In `src/server/round1/rendering-service.test.ts`, pass preferences into `generateRound1Rendering` and assert metadata:

```ts
const renderingPreferences = {
  cabinetStyle: "EUROPEAN_FRAMELESS" as const,
  color: {
    id: "eu-oak",
    companyId: "company",
    cabinetStyle: "EUROPEAN_FRAMELESS" as const,
    name: "Natural Oak Matte",
    colorCode: "EU-101",
    swatchImageUrl: "https://example.com/oak.jpg",
    swatchHex: "#d8c8ad",
    hoverExampleImageUrl: null,
    promptDescription: "warm natural oak matte slab cabinet doors",
    active: true,
    sortOrder: 1,
    createdAt: "2026-06-19T00:00:00.000Z",
    updatedAt: "2026-06-19T00:00:00.000Z"
  }
};
```

Add to the existing generation call:

```ts
renderingPreferences,
```

Assert:

```ts
expect(result.basedOnRenderingPreferences).toEqual({
  cabinetStyle: "EUROPEAN_FRAMELESS",
  doorColorId: "eu-oak",
  colorUpdatedAt: "2026-06-19T00:00:00.000Z"
});
expect(calls[0].prompt).toContain("warm natural oak matte slab cabinet doors");
```

- [ ] **Step 2: Run focused tests and verify they fail**

Run:

```bash
npm test -- src/features/round1/rendering-prompt.test.ts src/server/round1/rendering-service.test.ts
```

Expected: FAIL because the prompt and service signatures do not accept rendering preferences.

- [ ] **Step 3: Update prompt builder**

In `src/features/round1/rendering-prompt.ts`, add imports:

```ts
import type { CabinetStyle } from "@/domain/round1";
import type { CabinetColor } from "@/server/platform/cabinet-color-repository";
```

Add input type:

```ts
export type RenderingPromptPreferences = {
  cabinetStyle: CabinetStyle;
  color: CabinetColor;
};
```

Change signature:

```ts
export function buildRound1RenderingPrompt(
  snapshot: Round1Snapshot,
  preferences: RenderingPromptPreferences
): string {
```

Add helper:

```ts
function cabinetStylePhrase(preferences: RenderingPromptPreferences) {
  if (preferences.cabinetStyle === "AMERICAN_FRAMED") {
    return `American framed cabinetry with residential face-frame construction cues, using ${preferences.color.promptDescription}. Keep the door style consistent with the selected product color; do not invent unrelated cabinet finishes.`;
  }
  return `modern frameless European-style cabinetry (flat slab doors, clean reveals, continuous toe kicks, NO crown molding, NO top fascia board, NO soffit, NO top trim), using ${preferences.color.promptDescription}. Keep the door finish consistent with the selected product color; do not invent unrelated cabinet finishes.`;
}
```

Replace the current hard-coded `Design style:` line with:

```ts
`Design style: ${cabinetStylePhrase(preferences)} Calm contemporary California residential styling, bright natural daylight, and restrained neutral surfaces that complement the selected cabinet door color.`,
```

Replace the final `Cabinetry:` sentence style/color wording with:

```ts
`Cabinetry: approximately ${baseCount} base cabinet${
  baseCount === 1 ? "" : "s"
} and ${wallCount} wall cabinet${
  wallCount === 1 ? "" : "s"
}, using ${cabinetStylePhrase(preferences)}`,
```

- [ ] **Step 4: Update rendering service**

In `src/server/round1/rendering-service.ts`, import types:

```ts
import type { CabinetColor } from "@/server/platform/cabinet-color-repository";
import type { CabinetStyle } from "@/domain/round1";
```

Add type:

```ts
export type Round1RenderingPreferenceStamp = {
  cabinetStyle: CabinetStyle;
  doorColorId: string;
  colorUpdatedAt: string | null;
};
```

Add field to `Round1Rendering`:

```ts
basedOnRenderingPreferences: Round1RenderingPreferenceStamp;
```

Add input field:

```ts
renderingPreferences: {
  cabinetStyle: CabinetStyle;
  color: CabinetColor;
};
```

Build prompt:

```ts
const prompt = buildRound1RenderingPrompt(input.snapshot, input.renderingPreferences);
```

Return stamp:

```ts
basedOnRenderingPreferences: {
  cabinetStyle: input.renderingPreferences.cabinetStyle,
  doorColorId: input.renderingPreferences.color.id,
  colorUpdatedAt: input.renderingPreferences.color.updatedAt
},
```

- [ ] **Step 5: Update repository types and Postgres save**

In `src/server/round1/round1-repository.ts`, add `basedOnRenderingPreferences` to `Round1ProjectRendering`.

In `src/server/platform/round1-postgres-repository.ts`, update `saveRenderingHistory` insert columns:

```sql
based_on_snapshot_generated_at, based_on_cabinet_style,
based_on_door_color_id, based_on_color_updated_at, sales_estimate_only,
```

Add values:

```ts
input.rendering.basedOnRenderingPreferences.cabinetStyle,
input.rendering.basedOnRenderingPreferences.doorColorId,
input.rendering.basedOnRenderingPreferences.colorUpdatedAt,
```

Update returned object to include the new stamp from `input.rendering`.

- [ ] **Step 6: Resolve preferences in rendering route**

In `src/app/api/projects/[projectId]/round1/renderings/route.ts`, import:

```ts
import { getCabinetColor, isColorCompatibleWithStyle } from "@/server/platform/cabinet-color-repository";
import { getRound1State } from "@/server/platform/round1-postgres-repository";
```

Before calling `generateRound1Rendering`, load current state and color:

```ts
const state = await getRound1State(projectId);
const preferences = state?.showroomForm.renderingPreferences;
if (!preferences?.doorColorId) {
  return NextResponse.json({ error: "Rendering preferences required", reason: "DOOR_COLOR_REQUIRED" }, { status: 409 });
}
const color = await getCabinetColor(user.companyId, preferences.doorColorId);
if (!isColorCompatibleWithStyle(color, preferences.cabinetStyle)) {
  return NextResponse.json({ error: "Choose an active cabinet color", reason: "INVALID_DOOR_COLOR" }, { status: 409 });
}
```

Pass:

```ts
renderingPreferences: {
  cabinetStyle: preferences.cabinetStyle,
  color
}
```

- [ ] **Step 7: Run focused tests**

Run:

```bash
npm test -- src/features/round1/rendering-prompt.test.ts src/server/round1/rendering-service.test.ts src/server/platform/round1-postgres-repository.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

Run:

```bash
git add src/features/round1/rendering-prompt.ts src/features/round1/rendering-prompt.test.ts src/server/round1/rendering-service.ts src/server/round1/rendering-service.test.ts src/server/round1/round1-repository.ts src/server/platform/round1-postgres-repository.ts src/server/platform/round1-postgres-repository.test.ts 'src/app/api/projects/[projectId]/round1/renderings/route.ts'
git commit -m "feat(round1): use rendering preferences in concept prompt"
```

## Task 6: Final Verification And Manual QA

**Files:**
- Modify only if verification reveals focused defects.

- [ ] **Step 1: Run full automated verification**

Run:

```bash
npm test
npx tsc --noEmit
npm run build
```

Expected:

- `npm test`: all tests passing.
- `npx tsc --noEmit`: exits 0.
- `npm run build`: exits 0.

- [ ] **Step 2: Run database migration locally if `DATABASE_URL` is configured**

Run:

```bash
npm run db:migrate
```

Expected: migration completes without SQL errors and creates `cabinet_colors`.

If `DATABASE_URL` is not configured, skip this command and note that schema was verified by tests only.

- [ ] **Step 3: Manual QA Admin color library**

Start the app:

```bash
npm run dev
```

Open `/admin/cabinet-colors` as an Admin user.

Verify:

- Admin can create one European color with swatch image URL and hover example URL.
- Admin can create one American color.
- Inactive colors still show in Admin but do not show in Sales color board.
- Non-Admin users are redirected away from `/admin/cabinet-colors`.

- [ ] **Step 4: Manual QA Sales Round 1 flow**

Open a project Round 1 page.

Verify:

- Step list includes `Rendering Preferences`.
- Adjust Positions focuses on confirming fixed positions.
- Rendering Preferences shows European colors by default.
- Switching to American shows only American colors and clears incompatible selected color.
- Hovering a color shows the example image when configured.
- Clicking a color opens the confirm dialog.
- Cancel does not save the color.
- Confirm saves the color and enables rendering only after snapshot is saved.
- Changing only style/color after snapshot does not clear cabinet fill or snapshot.
- Existing rendering becomes stale after changing style/color.

- [ ] **Step 5: Manual QA rendering prompt**

Generate one rendering using a European color and one using an American color.

Verify in API response or stored rendering record:

- `prompt` contains the selected color's `promptDescription`.
- European prompt contains European frameless language.
- American prompt contains American framed language.
- `basedOnRenderingPreferences.doorColorId` matches the selected color.
- `basedOnSnapshotGeneratedAt` still matches the locked snapshot timestamp.

- [ ] **Step 6: Commit any verification fixes**

If verification required fixes, run:

```bash
git status --short
```

Then stage only the files changed by the verification fix and commit them with:

```bash
git commit -m "fix(round1): polish rendering preferences flow"
```

If no fixes were required, do not create an empty commit.

## Self-Review Checklist

- Spec coverage:
  - Dedicated Rendering Preferences step: Task 4.
  - European/American style choice: Tasks 1, 4, 5.
  - Independent color libraries: Tasks 2, 3, 4.
  - Large square swatches with real texture images: Tasks 3, 4.
  - Hover example image: Tasks 3, 4.
  - Click confirmation before saving color: Task 4.
  - Admin-only management: Tasks 2, 3.
  - Prompt style/color composition: Task 5.
  - Rendering staleness metadata: Tasks 4, 5.
  - Verification: Task 6.
- Placeholder scan:
  - No `TBD`, `TODO`, or unspecified "add tests" steps are intentionally left.
- Type consistency:
  - Cabinet style values are consistently `EUROPEAN_FRAMELESS` and `AMERICAN_FRAMED`.
  - Selected color field is consistently `doorColorId`.
  - Rendering stamp is consistently `basedOnRenderingPreferences`.
