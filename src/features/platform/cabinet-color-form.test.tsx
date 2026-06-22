import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { CabinetColorForm, buildCabinetColorPayload } from "./cabinet-color-form";

describe("CabinetColorForm", () => {
  test("renders the simplified upload-based fields", () => {
    const html = renderToStaticMarkup(<CabinetColorForm />);

    expect(html).toContain("Cabinet style");
    expect(html).toContain("Color name");
    expect(html).toContain("Swatch image");
    expect(html).toContain("Hover example image");
    expect(html).toContain("AI description");
    expect(html).toContain('type="file"');
  });

  test("drops the legacy URL/code/sort-order/active inputs from the add form", () => {
    const html = renderToStaticMarkup(<CabinetColorForm />);

    expect(html).not.toContain("Swatch image URL");
    expect(html).not.toContain("Hover example image URL");
    expect(html).not.toContain("Color code");
    expect(html).not.toContain("Fallback HEX");
    expect(html).not.toContain("Sort order");
    // Active is only exposed when editing an existing color.
    expect(html).not.toContain("Active");
  });

  test("exposes the Active toggle only when editing", () => {
    const html = renderToStaticMarkup(
      <CabinetColorForm
        color={{
          id: "c1",
          companyId: "co",
          cabinetStyle: "EUROPEAN_FRAMELESS",
          name: "Natural Oak Matte",
          colorCode: "EU-101",
          swatchImageUrl: "data:image/png;base64,AAA",
          swatchHex: null,
          hoverExampleImageUrl: null,
          promptDescription: "warm natural oak matte slab cabinet doors",
          active: true,
          sortOrder: 5,
          createdAt: "2026-06-19T00:00:00.000Z",
          updatedAt: "2026-06-19T00:00:00.000Z"
        }}
      />
    );

    expect(html).toContain("Active");
    expect(html).toContain("Edit color");
  });

  test("builds the create payload with an uploaded swatch", () => {
    expect(
      buildCabinetColorPayload({
        cabinetStyle: "EUROPEAN_FRAMELESS",
        name: "Natural Oak Matte",
        promptDescription: "warm natural oak matte slab cabinet doors",
        swatchImageUrl: "data:image/png;base64,AAA",
        hoverExampleImageUrl: null,
        active: true,
        sortOrder: 0
      })
    ).toEqual({
      cabinetStyle: "EUROPEAN_FRAMELESS",
      name: "Natural Oak Matte",
      promptDescription: "warm natural oak matte slab cabinet doors",
      swatchImageUrl: "data:image/png;base64,AAA",
      hoverExampleImageUrl: null,
      active: true,
      sortOrder: 0
    });
  });

  test("falls back to the name when the AI description is blank", () => {
    const payload = buildCabinetColorPayload({
      cabinetStyle: "AMERICAN_FRAMED",
      name: "Painted White",
      promptDescription: "   ",
      swatchImageUrl: null,
      hoverExampleImageUrl: null,
      active: true,
      sortOrder: 0
    });

    expect(payload.promptDescription).toBe("Painted White");
  });

  test("omits image fields left unchanged so existing uploads are preserved", () => {
    const payload = buildCabinetColorPayload({
      cabinetStyle: "EUROPEAN_FRAMELESS",
      name: "Natural Oak Matte",
      promptDescription: "warm natural oak matte slab cabinet doors",
      swatchImageUrl: undefined,
      hoverExampleImageUrl: undefined,
      active: true,
      sortOrder: 5
    });

    expect("swatchImageUrl" in payload).toBe(false);
    expect("hoverExampleImageUrl" in payload).toBe(false);
    expect(payload.sortOrder).toBe(5);
  });
});
