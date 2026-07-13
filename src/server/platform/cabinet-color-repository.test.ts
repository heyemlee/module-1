import { describe, expect, test } from "vitest";
import {
  buildCabinetColorListQuery,
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

  test("maps object-backed images to the private image proxy", () => {
    expect(
      mapCabinetColorRow({
        ...row,
        swatch_object_key: "cabinet-colors/color-1/swatch.webp",
        hover_object_key: "cabinet-colors/color-1/hover.webp"
      })
    ).toMatchObject({
      swatchImageUrl: "/api/cabinet-colors/11111111-1111-1111-1111-111111111111/image?variant=swatch",
      hoverExampleImageUrl: "/api/cabinet-colors/11111111-1111-1111-1111-111111111111/image?variant=hover"
    });
  });

  test("can build a lightweight list query without hover example image payloads", () => {
    const query = buildCabinetColorListQuery(false);

    expect(query).toContain("NULL::text AS hover_example_image_url");
    expect(query).not.toContain("swatch_hex, hover_example_image_url,");
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

  test("requires complete replacement fields", () => {
    const baseInput = {
      cabinetStyle: "AMERICAN_FRAMED",
      name: "Painted White",
      colorCode: "US-201",
      swatchImageUrl: "https://example.com/white.jpg",
      swatchHex: "#f4f1e8",
      hoverExampleImageUrl: "",
      promptDescription: "painted soft white framed cabinet doors"
    };

    expect(() => cabinetColorInputSchema.parse({ ...baseInput, sortOrder: 2 })).toThrow();
    expect(() => cabinetColorInputSchema.parse({ ...baseInput, active: true })).toThrow();
  });

  test("normalizes whitespace-only optional URLs to null", () => {
    const input = cabinetColorInputSchema.parse({
      cabinetStyle: "AMERICAN_FRAMED",
      name: "Painted White",
      colorCode: "US-201",
      swatchImageUrl: "   ",
      swatchHex: "#fff",
      hoverExampleImageUrl: "\t\n",
      promptDescription: "painted soft white framed cabinet doors",
      active: true,
      sortOrder: 2
    });

    expect(input.swatchImageUrl).toBeNull();
    expect(input.hoverExampleImageUrl).toBeNull();
  });

  test("does not default omitted nullable fields", () => {
    const input = cabinetColorInputSchema.parse({
      cabinetStyle: "AMERICAN_FRAMED",
      name: "Painted White",
      promptDescription: "painted soft white framed cabinet doors",
      active: true,
      sortOrder: 2
    });

    expect(input.colorCode).toBeUndefined();
    expect(input.swatchImageUrl).toBeUndefined();
    expect(input.swatchHex).toBeUndefined();
    expect(input.hoverExampleImageUrl).toBeUndefined();
  });

  test("rejects invalid optional URLs", () => {
    expect(() =>
      cabinetColorInputSchema.parse({
        cabinetStyle: "AMERICAN_FRAMED",
        name: "Painted White",
        colorCode: "US-201",
        swatchImageUrl: "not-a-url",
        swatchHex: "#fff",
        hoverExampleImageUrl: null,
        promptDescription: "painted soft white framed cabinet doors",
        active: true,
        sortOrder: 2
      })
    ).toThrow();
  });

  test("validates swatch hex colors", () => {
    expect(
      cabinetColorInputSchema.parse({
        cabinetStyle: "AMERICAN_FRAMED",
        name: "Painted White",
        colorCode: "US-201",
        swatchImageUrl: null,
        swatchHex: "#fff",
        hoverExampleImageUrl: null,
        promptDescription: "painted soft white framed cabinet doors",
        active: true,
        sortOrder: 2
      }).swatchHex
    ).toBe("#fff");

    expect(
      cabinetColorInputSchema.parse({
        cabinetStyle: "AMERICAN_FRAMED",
        name: "Painted White",
        colorCode: "US-201",
        swatchImageUrl: null,
        swatchHex: "#f4f1e8",
        hoverExampleImageUrl: null,
        promptDescription: "painted soft white framed cabinet doors",
        active: true,
        sortOrder: 2
      }).swatchHex
    ).toBe("#f4f1e8");

    expect(() =>
      cabinetColorInputSchema.parse({
        cabinetStyle: "AMERICAN_FRAMED",
        name: "Painted White",
        colorCode: "US-201",
        swatchImageUrl: null,
        swatchHex: "white",
        hoverExampleImageUrl: null,
        promptDescription: "painted soft white framed cabinet doors",
        active: true,
        sortOrder: 2
      })
    ).toThrow();
  });

  test("checks color/style compatibility", () => {
    expect(isColorCompatibleWithStyle(mapCabinetColorRow(row), "EUROPEAN_FRAMELESS")).toBe(true);
    expect(isColorCompatibleWithStyle(mapCabinetColorRow(row), "AMERICAN_FRAMED")).toBe(false);
  });
});
