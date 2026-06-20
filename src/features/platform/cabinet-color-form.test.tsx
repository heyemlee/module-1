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
