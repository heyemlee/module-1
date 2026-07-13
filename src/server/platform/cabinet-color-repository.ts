import { z } from "zod";
import { randomUUID } from "node:crypto";
import { query } from "@/server/db/client";
import type { CabinetStyle } from "@/domain/round1";
import { buildObjectKey, createBucketStorageFromEnv } from "@/server/storage/bucket";

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
  swatch_object_key?: string | null;
  swatch_hex: string | null;
  hover_example_image_url: string | null;
  hover_object_key?: string | null;
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
  const swatchImageUrl = row.swatch_object_key
    ? `/api/cabinet-colors/${row.id}/image?variant=swatch`
    : row.swatch_image_url;
  const hoverExampleImageUrl = row.hover_object_key
    ? `/api/cabinet-colors/${row.id}/image?variant=hover`
    : row.hover_example_image_url;

  return {
    id: row.id,
    companyId: row.company_id,
    cabinetStyle: row.cabinet_style,
    name: row.name,
    colorCode: row.color_code,
    swatchImageUrl,
    swatchHex: row.swatch_hex,
    hoverExampleImageUrl,
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
            swatch_object_key, swatch_hex, ${hoverExampleColumn}, hover_object_key,
            prompt_description, active,
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

/**
 * Lightweight id→name lookup for callers that only need to label a color (e.g.
 * the rendering gallery) and must not pull the heavy swatch/hover image columns.
 * The full list with images is ~73MB per company over the remote DB; this is KB.
 */
export async function listCabinetColorNames(companyId: string) {
  const result = await query<{ id: string; name: string }>(
    `SELECT id, name FROM cabinet_colors WHERE company_id = $1 ORDER BY name ASC`,
    [companyId]
  );
  return result.rows.map((row) => ({ id: row.id, name: row.name }));
}

export async function getCabinetColor(companyId: string, colorId: string) {
  const result = await query<CabinetColorRow>(
    `SELECT id, company_id, cabinet_style, name, color_code, swatch_image_url,
            swatch_object_key, swatch_hex, hover_example_image_url, hover_object_key,
            prompt_description, active,
            sort_order, created_at, updated_at
     FROM cabinet_colors
     WHERE company_id = $1 AND id = $2`,
    [companyId, colorId]
  );
  return result.rows[0] ? mapCabinetColorRow(result.rows[0]) : null;
}

export async function createCabinetColor(companyId: string, input: CabinetColorInput) {
  const id = randomUUID();
  const storage = createBucketStorageFromEnv(process.env);
  const swatch = await storeInlineImage(storage, id, "swatch", input.swatchImageUrl);
  const hover = await storeInlineImage(storage, id, "hover", input.hoverExampleImageUrl);
  const result = await query<CabinetColorRow>(
    `INSERT INTO cabinet_colors (
       id, company_id, cabinet_style, name, color_code, swatch_image_url,
       swatch_object_key, swatch_hex, hover_example_image_url, hover_object_key,
       prompt_description, active, sort_order
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     RETURNING id, company_id, cabinet_style, name, color_code, swatch_image_url,
               swatch_object_key, swatch_hex, hover_example_image_url, hover_object_key,
               prompt_description, active,
               sort_order, created_at, updated_at`,
    [
      id,
      companyId,
      input.cabinetStyle,
      input.name,
      input.colorCode ?? null,
      swatch.legacyValue,
      swatch.objectKey,
      input.swatchHex ?? null,
      hover.legacyValue,
      hover.objectKey,
      input.promptDescription,
      input.active,
      input.sortOrder
    ]
  );
  return mapCabinetColorRow(result.rows[0]);
}

export async function updateCabinetColor(companyId: string, colorId: string, input: CabinetColorInput) {
  const storage = createBucketStorageFromEnv(process.env);
  const swatch = await storeInlineImage(storage, colorId, "swatch", input.swatchImageUrl);
  const hover = await storeInlineImage(storage, colorId, "hover", input.hoverExampleImageUrl);
  const result = await query<CabinetColorRow>(
    `UPDATE cabinet_colors SET
       cabinet_style = $3,
       name = $4,
       color_code = CASE WHEN $5::boolean THEN $6 ELSE color_code END,
       swatch_image_url = CASE WHEN $7::boolean THEN $8 ELSE swatch_image_url END,
       swatch_object_key = CASE WHEN $9::boolean THEN $10 ELSE swatch_object_key END,
       swatch_hex = CASE WHEN $11::boolean THEN $12 ELSE swatch_hex END,
       hover_example_image_url = CASE WHEN $13::boolean THEN $14 ELSE hover_example_image_url END,
       hover_object_key = CASE WHEN $15::boolean THEN $16 ELSE hover_object_key END,
       prompt_description = $17,
       active = $18,
       sort_order = $19,
       updated_at = now()
     WHERE company_id = $1 AND id = $2
     RETURNING id, company_id, cabinet_style, name, color_code, swatch_image_url,
               swatch_object_key, swatch_hex, hover_example_image_url, hover_object_key,
               prompt_description, active,
               sort_order, created_at, updated_at`,
    [
      companyId,
      colorId,
      input.cabinetStyle,
      input.name,
      input.colorCode !== undefined,
      input.colorCode ?? null,
      input.swatchImageUrl !== undefined,
      swatch.legacyValue,
      input.swatchImageUrl !== undefined,
      swatch.objectKey,
      input.swatchHex !== undefined,
      input.swatchHex ?? null,
      input.hoverExampleImageUrl !== undefined,
      hover.legacyValue,
      input.hoverExampleImageUrl !== undefined,
      hover.objectKey,
      input.promptDescription,
      input.active,
      input.sortOrder
    ]
  );
  return result.rows[0] ? mapCabinetColorRow(result.rows[0]) : null;
}

function parseInlineImage(value: string) {
  const match = value.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/s);
  if (!match) return null;
  return {
    contentType: match[1],
    body: Buffer.from(match[2], "base64"),
    extension: match[1].split("/")[1].replace("jpeg", "jpg")
  };
}

async function storeInlineImage(
  storage: ReturnType<typeof createBucketStorageFromEnv>,
  colorId: string,
  variant: "swatch" | "hover",
  value: string | null | undefined
) {
  if (!value || !storage) return { legacyValue: value ?? null, objectKey: null };
  const image = parseInlineImage(value);
  if (!image) return { legacyValue: value, objectKey: null };
  const key = buildObjectKey("cabinet-colors", colorId, `${variant}.${image.extension}`);
  await storage.uploadObject(key, image.body, image.contentType);
  return { legacyValue: null, objectKey: key };
}

export async function getCabinetColorImage(
  companyId: string,
  colorId: string,
  variant: "swatch" | "hover"
) {
  const column = variant === "swatch" ? "swatch_object_key" : "hover_object_key";
  const legacyColumn = variant === "swatch" ? "swatch_image_url" : "hover_example_image_url";
  const result = await query<{ object_key: string | null; legacy_value: string | null }>(
    `SELECT ${column} AS object_key, ${legacyColumn} AS legacy_value
     FROM cabinet_colors WHERE company_id = $1 AND id = $2 LIMIT 1`,
    [companyId, colorId]
  );
  const row = result.rows[0];
  if (!row) return null;
  const storage = createBucketStorageFromEnv(process.env);
  if (row.object_key && storage) {
    try {
      return await storage.getObject(row.object_key);
    } catch (error) {
      if (!row.legacy_value?.startsWith("data:")) throw error;
    }
  }
  const image = row.legacy_value?.match(/^data:(image\/[^;]+);base64,(.+)$/s);
  return image
    ? { body: Buffer.from(image[2], "base64"), contentType: image[1] }
    : null;
}
