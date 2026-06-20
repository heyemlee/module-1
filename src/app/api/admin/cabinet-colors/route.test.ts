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
