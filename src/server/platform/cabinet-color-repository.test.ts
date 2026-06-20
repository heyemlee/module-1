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
