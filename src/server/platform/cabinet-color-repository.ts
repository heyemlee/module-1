import { z } from "zod";
import { query } from "@/server/db/client";
import type { CabinetStyle } from "@/domain/round1";

// Accepts either a hosted image URL or an inline uploaded image (data URL,
// produced by the admin file picker). Whitespace-only values normalize to null.
const nullableImageSource = z
  .preprocess(
    (value) => (typeof value === "string" ? value.trim() : value),
    z.union([
      z.string().url(),
      z.string().regex(/^data:image\/[a-zA-Z0-9.+-]+;base64,/),
      z.literal(""),
      z.null(),
      z.undefined()
    ])
  )
  .transform((value) => {
    if (value === "" || value === null) return null;
    return value;
  });

const nullableTrimmedString = z
  .preprocess(
    (value) => (typeof value === "string" ? value.trim() : value),
    z.union([z.string(), z.null(), z.undefined()])
  )
  .transform((value) => {
    if (value === "" || value === null) return null;
    return value;
  });

const nullableSwatchHex = z
  .preprocess(
    (value) => (typeof value === "string" ? value.trim() : value),
    z.union([
      z.string().regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/),
      z.literal(""),
      z.null(),
      z.undefined()
    ])
  )
  .transform((value) => {
    if (value === "" || value === null) return null;
    return value;
  });

export const cabinetColorInputSchema = z.object({
  cabinetStyle: z.enum(["EUROPEAN_FRAMELESS", "AMERICAN_FRAMED"]),
  name: z.string().trim().min(1),
  colorCode: nullableTrimmedString,
  swatchImageUrl: nullableImageSource,
  swatchHex: nullableSwatchHex,
  hoverExampleImageUrl: nullableImageSource,
  promptDescription: z.string().trim().min(1),
  active: z.boolean(),
  sortOrder: z.number().int()
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

export function buildCabinetColorListQuery(includeHoverExampleImages = true) {
  const hoverExampleColumn = includeHoverExampleImages
    ? "hover_example_image_url"
    : "NULL::text AS hover_example_image_url";

  return `SELECT id, company_id, cabinet_style, name, color_code, swatch_image_url,
            swatch_hex, ${hoverExampleColumn}, prompt_description, active,
            sort_order, created_at, updated_at
     FROM cabinet_colors
     WHERE company_id = $1 AND ($2::boolean = false OR active = true)
     ORDER BY cabinet_style ASC, sort_order ASC, name ASC`;
}

export async function listCabinetColors(
  companyId: string,
  activeOnly = false,
  options: { includeHoverExampleImages?: boolean } = {}
) {
  const result = await query<CabinetColorRow>(
    buildCabinetColorListQuery(options.includeHoverExampleImages ?? true),
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
      input.colorCode ?? null,
      input.swatchImageUrl ?? null,
      input.swatchHex ?? null,
      input.hoverExampleImageUrl ?? null,
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
       color_code = CASE WHEN $5::boolean THEN $6 ELSE color_code END,
       swatch_image_url = CASE WHEN $7::boolean THEN $8 ELSE swatch_image_url END,
       swatch_hex = CASE WHEN $9::boolean THEN $10 ELSE swatch_hex END,
       hover_example_image_url = CASE WHEN $11::boolean THEN $12 ELSE hover_example_image_url END,
       prompt_description = $13,
       active = $14,
       sort_order = $15,
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
      input.colorCode !== undefined,
      input.colorCode ?? null,
      input.swatchImageUrl !== undefined,
      input.swatchImageUrl ?? null,
      input.swatchHex !== undefined,
      input.swatchHex ?? null,
      input.hoverExampleImageUrl !== undefined,
      input.hoverExampleImageUrl ?? null,
      input.promptDescription,
      input.active,
      input.sortOrder
    ]
  );
  return result.rows[0] ? mapCabinetColorRow(result.rows[0]) : null;
}
